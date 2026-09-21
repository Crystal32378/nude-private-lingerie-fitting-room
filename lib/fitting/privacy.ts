/**
 * Hobby-mode privacy guard. v3 §十三 / AT-15.
 *
 * ZDR needs a Pro plan; we are on hobby. The ruling is stricter than disclosure:
 * the raw life-problem text NEVER leaves the browser.
 *
 * This is a STRICT SCHEMA, not a heuristic. Guessing whether a string "looks like"
 * prose is the wrong shape of defence — a short sentence slips through a length
 * check, and a legal-looking field can still carry free text. So instead:
 * an outbound payload is valid only if every field is one we declared and every
 * value is one of the exact values we declared. Everything else throws.
 */
import { NUDE_PRODUCTS, type Product } from "../products.ts";
import { emptyFrame, type SituationFrame, type TradeoffTask, type UserField } from "./types.ts";
import { runGates } from "./gates.ts";
import { buildBasketOptions } from "./promotion.ts";

export class PrivacyViolationError extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`Hobby privacy guard blocked the request: ${reasons.join("; ")}`);
    this.name = "PrivacyViolationError";
    this.reasons = reasons;
  }
}

// ---------------------------------------------------------------- schema

type FieldSpec =
  | { kind: "boolean" }
  | { kind: "enum"; values: readonly string[] };

/** The complete set of context fields that may cross the network, and their legal values. */
export const CONTEXT_SCHEMA = {
  outerGarment: { kind: "enum", values: ["thin_fitted", "thick_or_loose", "other", "not_stated"] },
  wearDuration: { kind: "enum", values: ["under_4", "4_to_8", "over_8", "not_stated"] },
  priority: { kind: "enum", values: ["comfort", "shaping", "balanced", "movement", "not_stated"] },
  needsNudeColourway: { kind: "boolean" },
  requiresNoVisibleLines: { kind: "boolean" },
  basketPriority: { kind: "enum", values: ["lowest_total", "construction_balance"] },
  canReachBackClosure: { kind: "boolean" },
  canRotateBandAroundTorso: { kind: "boolean" },
  canRaiseArmsOverhead: { kind: "boolean" },
  canPassOverHead: { kind: "boolean" },
  canPerformFineMotorPinch: { kind: "boolean" },
} as const satisfies Record<string, FieldSpec>;

export type ContextKey = keyof typeof CONTEXT_SCHEMA;
declare const CONTEXT_BRAND: unique symbol;
export type OutboundContext = Readonly<{
  [K in ContextKey]?: NonNullable<SituationFrame[K]["value"]>;
}> & { readonly [CONTEXT_BRAND]: true };
const builtContexts = new WeakSet<object>();

/** Product fields that may be sent as JEV state. Anything outside this is rejected. */
export const PRODUCT_STATE_ALLOWLIST = [
  "id", "category", "closure", "wire", "padding", "straps", "cup", "material", "structureNotes",
] as const satisfies readonly (keyof Product)[];
export type ProductStateKey = (typeof PRODUCT_STATE_ALLOWLIST)[number];
declare const PRODUCT_BRAND: unique symbol;
export type ProductState = Readonly<Pick<Product, ProductStateKey>> & { readonly [PRODUCT_BRAND]: true };
const projectedProducts = new WeakSet<object>();

const PRODUCT_KEYS = new Set<string>(PRODUCT_STATE_ALLOWLIST);
const CONTEXT_KEYS = new Set<string>(Object.keys(CONTEXT_SCHEMA));
// Canonical source fields that are deliberately omitted from the JEV projection.
const PRODUCT_SOURCE_KEYS = new Set<string>([
  ...PRODUCT_STATE_ALLOWLIST, "nameZh", "nameEn", "productUrl", "sku", "price", "priceLabel",
  "displayImage", "vtoImage", "vtoAssets", "colors", "sizes", "description", "youcamCategory",
] satisfies (keyof Product)[]);
const FRAME_KEYS = new Set<string>([
  ...Object.keys(CONTEXT_SCHEMA), "matchingSetDesired", "pantySize", "quantityIntent",
  "tripDurationDays", "budgetMaxTwd", "budgetCovers", "requiredByDate", "receiveMethod", "area",
]);

/** No accessors, custom serializers, inherited properties or symbol fields. */
export function isDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Reflect.ownKeys(value).every(key =>
    typeof key === "string" && Object.getOwnPropertyDescriptor(value, key)?.enumerable === true
      && "value" in Object.getOwnPropertyDescriptor(value, key)!);
}

function validContextValue(key: ContextKey, value: unknown): boolean {
  const spec: FieldSpec = CONTEXT_SCHEMA[key];
  return spec.kind === "boolean" ? typeof value === "boolean"
    : typeof value === "string" && spec.values.includes(value);
}

// ---------------------------------------------------------------- build

/**
 * Emits a frozen, registered snapshot of confirmed UserFields only. The guard
 * rejects even schema-valid primitive objects that bypass this builder. Rebuild
 * from UserFields at the server boundary; never forward a deserialized context.
 */
export function buildOutboundContext(frame: SituationFrame): OutboundContext {
  if (!isDataRecord(frame) || Object.keys(frame).some(key => !FRAME_KEYS.has(key))) {
    throw new PrivacyViolationError(["frame must contain only declared SituationFrame fields"]);
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(CONTEXT_SCHEMA) as ContextKey[]) {
    if (!Object.hasOwn(frame, key)) continue;
    const field: unknown = frame[key];
    if (!isDataRecord(field) || Object.keys(field).length !== 2
      || !Object.hasOwn(field, "value") || !Object.hasOwn(field, "provenance")
      || !["confirmed", "stated", "unknown"].includes(field.provenance as string)) {
      throw new PrivacyViolationError([`frame.${key}: expected a UserField`]);
    }
    if (field.value === null) continue;
    if (!validContextValue(key, field.value)) {
      // Never echo rejected values into errors, logs, or artifacts.
      throw new PrivacyViolationError([`frame.${key}: value is outside the closed schema`]);
    }
    // Only what she has confirmed. `stated` is her words; `confirmed` is her answer.
    if (field.provenance !== "confirmed") continue;
    out[key] = field.value;
  }
  Object.freeze(out);
  builtContexts.add(out);
  return out as OutboundContext;
}

/** Project only canonical construction facts. Unknown source fields throw; known
 *  local fields such as price and images are deliberately not model evidence. */
export function projectProductState(product: Product): ProductState {
  if (!isDataRecord(product)) throw new Error("InvalidEvidenceField: invalid product source");
  for (const key of Object.keys(product)) {
    if (!PRODUCT_SOURCE_KEYS.has(key)) throw new Error(`InvalidEvidenceField: ${key} not in canonical product schema`);
  }
  const canonical = NUDE_PRODUCTS.find(p => p.id === product.id);
  if (!canonical) throw new Error("InvalidEvidenceField: unknown canonical product");
  const out: Partial<Pick<Product, ProductStateKey>> = {};
  for (const key of PRODUCT_STATE_ALLOWLIST) {
    if (typeof product[key] !== "string" || product[key] !== canonical[key]) {
      throw new Error(`InvalidEvidenceField: ${key} does not match canonical evidence`);
    }
    out[key] = canonical[key];
  }
  Object.freeze(out);
  projectedProducts.add(out);
  return out as ProductState;
}

export function assertProductState(product: unknown): asserts product is ProductState {
  if (!isDataRecord(product)) throw new Error("InvalidEvidenceField: product state is required");
  for (const key of Object.keys(product)) {
    if (!PRODUCT_KEYS.has(key)) throw new Error(`InvalidEvidenceField: ${key} not in the product allowlist`);
  }
  if (!projectedProducts.has(product)) throw new Error("InvalidEvidenceField: product must come from canonical projection");
  for (const key of PRODUCT_STATE_ALLOWLIST) {
    if (typeof product[key] !== "string") throw new Error(`InvalidEvidenceField: missing or invalid ${key}`);
  }
}

// ---------------------------------------------------------------- validate

function checkContext(ctx: unknown, reasons: string[]): void {
  if (ctx === undefined) return;
  if (!isDataRecord(ctx) || !builtContexts.has(ctx)) {
    reasons.push("state.context must be an object built by buildOutboundContext");
    return;
  }
  for (const [k, v] of Object.entries(ctx)) {
    if (!CONTEXT_KEYS.has(k) || !validContextValue(k as ContextKey, v)) {
      reasons.push("state.context contains a field or value outside the closed schema");
    }
  }
}

function checkProduct(prod: unknown, reasons: string[]): void {
  try { assertProductState(prod); }
  catch (error) { reasons.push((error as Error).message); }
}

/**
 * Inspect a payload immediately before it is sent. Throws rather than sanitising:
 * silently stripping would hide a bug that belongs upstream.
 */
export function assertHobbySafe(payload: unknown): void {
  const reasons: string[] = [];
  if (!isDataRecord(payload)) {
    throw new PrivacyViolationError(["payload must be an object"]);
  }
  const p = payload as Record<string, unknown>;
  for (const k of Object.keys(p)) {
    if (!["model", "state", "questions", "providerOptions"].includes(k)) {
      reasons.push("unexpected top-level key");
    }
  }
  const state = p.state;
  if (!isDataRecord(state)) {
    reasons.push("state must be an object");
  } else {
    if ("task" in state) {
      assertTradeoffState(state);
      if (!projectedPayloads.has(payload)) throw new PrivacyViolationError(["untrusted task envelope"]);
      if (reasons.length) throw new PrivacyViolationError(reasons);
      return;
    }
    for (const k of Object.keys(state as Record<string, unknown>)) {
      if (k !== "product" && k !== "context") reasons.push("state contains an unexpected key");
    }
    checkProduct((state as Record<string, unknown>).product, reasons);
    checkContext((state as Record<string, unknown>).context, reasons);
  }
  if (reasons.length > 0) throw new PrivacyViolationError(reasons);
}

export function isHobbySafe(payload: unknown): boolean {
  try { assertHobbySafe(payload); return true; } catch { return false; }
}

// The HTTP ingress is deliberately smaller than SituationFrame. No raw text,
// logistics, caller-provided product, prices, instructions, or evidence fields.
export const TASK_FIELD_VALUES = {
  outerGarment: ["thin_fitted", "thick_or_loose", "other", "not_stated"],
  wearDuration: ["under_4", "4_to_8", "over_8", "not_stated"],
  priority: ["comfort", "shaping", "balanced", "movement", "not_stated"],
  needsNudeColourway: [true, false], requiresNoVisibleLines: [true, false],
  canReachBackClosure: [true, false], canRotateBandAroundTorso: [true, false],
  canRaiseArmsOverhead: [true, false], canPassOverHead: [true, false], canPerformFineMotorPinch: [true, false],
  matchingSetDesired: [true, false], quantityIntent: [1, 2, 3], budgetMaxTwd: [3000, 5000, 8000],
  basketPriority: ["lowest_total", "construction_balance"],
} as const;
export type TaskField = keyof typeof TASK_FIELD_VALUES;
export interface TaskRequest { task: TradeoffTask; fields: Partial<{ [K in TaskField]: SituationFrame[K] }> }

export function parseTaskRequest(input: unknown): { task: TradeoffTask; frame: SituationFrame } {
  const reject = () => { throw new PrivacyViolationError(["invalid typed task request"]); };
  if (!isDataRecord(input) || Object.keys(input).length !== 2
    || (input.task !== "style_tradeoff" && input.task !== "basket_tradeoff") || !isDataRecord(input.fields)) return reject();
  const frame = emptyFrame();
  for (const [key, field] of Object.entries(input.fields)) {
    if (!Object.hasOwn(TASK_FIELD_VALUES, key) || !isDataRecord(field) || Object.keys(field).length !== 2
      || field.provenance !== "confirmed" || !Object.hasOwn(field, "value")) return reject();
    const allowed: readonly unknown[] = TASK_FIELD_VALUES[key as TaskField];
    if (!allowed.includes(field.value)) return reject();
    (frame as unknown as Record<string, UserField<unknown>>)[key] = { value: field.value, provenance: "confirmed" };
  }
  return { task: input.task, frame };
}

export function buildTaskRequest(task: TradeoffTask, frame: SituationFrame): TaskRequest {
  const fields: Record<string, UserField<unknown>> = {};
  for (const key of Object.keys(TASK_FIELD_VALUES) as TaskField[]) {
    const field = frame[key];
    if (field.provenance === "confirmed" && field.value !== null) fields[key] = { value: field.value, provenance: "confirmed" };
  }
  const request = { task, fields } as TaskRequest;
  parseTaskRequest(request);
  return request;
}

export interface ProjectedBasket {
  id: string; braId: string; pantyId: string | null;
  lines: readonly Readonly<{ id: string; quantity: number; unitPrice: number }>[];
  preDiscountTotal: number; defaultTotal: number; simulationTotal: number; isSimulation: boolean;
}
export interface TradeoffState {
  readonly task: TradeoffTask;
  readonly products: readonly ProductState[];
  readonly context: OutboundContext;
  readonly baskets?: readonly ProjectedBasket[];
}
const projectedTasks = new WeakSet<object>();
const STRUCTURAL_EVIDENCE = ["closure", "wire", "padding", "straps", "material", "structureNotes"] as const;

/** All four call conditions are enforced here, again on the server. This is a
 * projection from facts, not a way for the caller to supply model state. */
export function projectTradeoffState(task: TradeoffTask, input: SituationFrame): TradeoffState | null {
  const { frame } = parseTaskRequest(buildTaskRequest(task, input));
  if (frame.requiresNoVisibleLines.value === true || frame.canReachBackClosure.value === null
    || frame.needsNudeColourway.value === null) return null;
  const eligible = runGates(frame).eligibleBraIds;
  let products = NUDE_PRODUCTS.filter(p => eligible.includes(p.id));
  if (frame.quantityIntent.value !== null && frame.matchingSetDesired.value !== null && frame.budgetMaxTwd.value !== null) {
    const affordable = new Set(buildBasketOptions(frame).map(b => b.braId));
    products = products.filter(p => affordable.has(p.id));
  }
  const contextFrame = emptyFrame();
  contextFrame.priority = frame.priority;
  contextFrame.outerGarment = frame.outerGarment;
  let baskets: readonly ProjectedBasket[] | undefined;
  if (task === "style_tradeoff") {
    if (!frame.priority.value || frame.priority.value === "not_stated" || products.length < 2) return null;
  } else {
    if (frame.basketPriority.value !== "construction_balance" || !frame.priority.value || frame.priority.value === "not_stated") return null;
    const options = buildBasketOptions(frame).filter(b => !b.needsReview);
    if (options.length < 2 || new Set(options.map(b => b.calculation.defaultTotal)).size < 2) return null;
    products = products.filter(p => options.some(b => b.braId === p.id));
    contextFrame.basketPriority = frame.basketPriority;
    baskets = Object.freeze(options.map(b => Object.freeze({ id: b.id, braId: b.braId, pantyId: b.pantyId,
      lines: Object.freeze(b.lines.map(l => Object.freeze({ id: l.id, quantity: l.qty, unitPrice: l.price }))),
      preDiscountTotal: b.calculation.preDiscountTotal, defaultTotal: b.calculation.defaultTotal,
      simulationTotal: b.calculation.finalTotal, isSimulation: b.calculation.isSimulation })));
  }
  if (products.some(p => STRUCTURAL_EVIDENCE.some(key => !p[key]?.trim()))) return null;
  // If the relevant construction is identical, rules already describe the tie.
  if (new Set(products.map(p => JSON.stringify(STRUCTURAL_EVIDENCE.map(k => p[k])))).size < 2) return null;
  const state: TradeoffState = Object.freeze({ task, products: Object.freeze(products.map(projectProductState)),
    context: buildOutboundContext(contextFrame), ...(baskets ? { baskets } : {}) });
  projectedTasks.add(state);
  return state;
}

export function assertTradeoffState(state: unknown): asserts state is TradeoffState {
  if (!isDataRecord(state) || !projectedTasks.has(state)) throw new PrivacyViolationError(["untrusted tradeoff projection"]);
  const reasons: string[] = [];
  checkContext(state.context, reasons);
  for (const product of (state as unknown as TradeoffState).products) checkProduct(product, reasons);
  if (reasons.length) throw new PrivacyViolationError(reasons);
}

const STYLE_CRITERIA = Object.freeze({
  prefer: "Given the confirmed preference, this construction is worth prioritising among the supplied eligible options. No fit or comfort guarantee.",
  consider: "Worth considering, with a meaningful construction trade-off. No assumption about actual fit or long-wear comfort.",
  lower_priority: "Lower priority for the confirmed preference relative to the other eligible options. This is not a hard exclusion.",
  insufficient_evidence: "The supplied construction facts do not support a preference judgment.",
});


const projectedPayloads = new WeakSet<object>();

/** Fixed question vocabulary; neither the browser nor a caller can provide prompts. */
export function buildTradeoffPayload(state: TradeoffState) {
  assertTradeoffState(state);
  const questions: Record<string, { type: "choice"; criteria: Record<string, string>; instructions: string }> = {};
  if (state.task === "style_tradeoff") {
    for (const product of state.products) {
      const id = `style_${product.id}`;
      questions[id] = { type: "choice", criteria: STYLE_CRITERIA,
        instructions: `Assess product ${product.id} relative to state.products and confirmed context.priority. Use only supplied construction evidence. Do not judge the person's body, medical safety, size, actual comfort, opacity or visibility through a shirt. Do not reinterpret hard constraints. Missing relevant evidence means insufficient_evidence. The result changes candidate priority only.` };
    }
  } else {
    const criteria: Record<string, string> = {};
    for (const basket of state.baskets!) criteria[basket.id] = `Prioritise the existing basket ${basket.id} under the confirmed preference. Quantities and defaultTotal are fixed facts. Never optimise using simulationTotal.`;
    criteria.insufficient_evidence = "No supported preference between the supplied baskets; leave the choice with the person.";
    questions.basket_tradeoff = { type: "choice", criteria,
      instructions: "Compare only state.baskets using the corresponding state.products construction and confirmed preference. Code has computed all totals and filtered hard constraints and budget. Weigh the construction trade-off against defaultTotal; never recalculate, change quantity, invent an item, assume member pricing, or use simulationTotal as payable. Do not guarantee physical comfort or fit. Select insufficient_evidence if the preference cannot be supported." };
  }
  for (const question of Object.values(questions)) { Object.freeze(question.criteria); Object.freeze(question); }
  const body = Object.freeze({ model: "typesafe-ai/jev", state, questions: Object.freeze(questions),
    providerOptions: Object.freeze({ gateway: Object.freeze({ disallowPromptTraining: true, only: Object.freeze(["typesafe-ai"]) }) }) });
  projectedPayloads.add(body);
  return body;
}
