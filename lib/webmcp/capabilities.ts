"use client";

/**
 * The four capabilities NUDE exposes to a visitor's own agent over WebMCP.
 *
 * Two rules govern this interface, and they are about different things.
 *
 * 1. **No photo of the person and no try-on result is returned through these
 *    tools.** That is a claim about this interface only — rendering a fitting
 *    does send the photo to Perfect Corp's YouCam service, as the README's
 *    Privacy section documents. `PERSONAL_IMAGE` stands in wherever such a
 *    field would sit, so the absence is explicit rather than merely implied.
 *
 * 2. **Garment imagery and product pages are exposed on purpose.** They are
 *    NUDE's own public product photography, not anybody's private data, and an
 *    agent needs them to know what it is about to render. Withholding them
 *    would only make it guess.
 *
 * The second rule exists because of the first principle of this layer:
 * **correctness before speed.** A fitting room is finished work, not a fast
 * answer. An agent is expected to read the construction data, drill into the
 * pieces that look plausible, see the actual garment asset a render will use,
 * try pieces on one at a time, and — where it cannot confirm something — say
 * so rather than render a result that quietly misleads. `prepare_fitting_room`
 * enforces the shape of that: it will not accept a shortlist without a real
 * generated render *and* a stated reason for every single piece.
 */

import { NUDE_PRODUCTS, PRODUCT_COUNT, getProductById } from "@/lib/products";
import {
  COMPARE_MAX,
  COMPARE_MIN,
  currentPreparation,
  useShowroomStore,
} from "@/lib/store";

export const PERSONAL_IMAGE =
  "not returned through WebMCP — no photo of the person and no try-on result leaves through these tools" as const;

/** Back-compat alias. */
export const IMAGE_PAYLOAD = PERSONAL_IMAGE;

const BRIEF_MAX = 200;
const WHY_MAX = 200;
// Generous on purpose: this field exists so an agent can be fully honest about
// what it could not confirm. A tight cap would force it to truncate exactly the
// disclosure the field is for.
const CAVEAT_MAX = 700;

type Failure = {
  ok: false;
  code: string;
  message: string;
  retrySafe: boolean;
  [extra: string]: unknown;
};

function fail(
  code: string,
  message: string,
  retrySafe: boolean,
  extra: Record<string, unknown> = {}
): Failure {
  return { ok: false, code, message, retrySafe, ...extra };
}

const NOT_HYDRATED = () =>
  fail(
    "FITTING_ROOM_NOT_READY",
    "The fitting room is still reading this browser's local storage. Try again in a moment.",
    true
  );

/* ------------------------------------------------------------------ *
 * 1. nude.list_pieces — read-only
 * ------------------------------------------------------------------ */

/**
 * The full construction detail for all nine pieces. The catalogue grid on
 * screen shows only name, Chinese name and price; wire, cup, padding, straps,
 * closure and the structure notes live one navigation deeper. This returns all
 * of it in a single call, which is what lets an agent answer a question like
 * "smooth under a white shirt" without nine page visits and nine OCR passes.
 */
export function listPieces() {
  return {
    brand: "NUDE",
    count: PRODUCT_COUNT,
    currency: "TWD",
    personalImages: PERSONAL_IMAGE,
    tryOn: {
      model: "Perfect Corp cloth-v4",
      colourway:
        "Each piece has one fixed reference garment image, so a try-on renders that single colourway. `colors` lists the colourways available to buy — it is NOT a choice a try-on can honour. Do not promise the person a colour on the strength of that list. Call nude.get_piece to see the actual garment asset a render will use, and open productUrl if you need to confirm what else exists before committing.",
    },
    workingNote:
      "This is a starting point, not an answer. Read the construction fields, drill into the plausible pieces with nude.get_piece, and only then render. Taking longer and getting it right is the expected behaviour here.",
    pieces: NUDE_PRODUCTS.map((p) => ({
      pieceId: p.id,
      name: p.nameEn,
      nameZh: p.nameZh,
      category: p.category,
      price: p.price,
      priceLabel: p.priceLabel,
      colors: p.colors,
      sizes: p.sizes,
      material: p.material,
      wire: p.wire,
      cup: p.cup,
      padding: p.padding,
      straps: p.straps,
      closure: p.closure,
      structureNotes: p.structureNotes,
      productUrl: p.productUrl,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * 2. nude.get_piece — read-only, the drill-down
 * ------------------------------------------------------------------ */

/**
 * One piece, in full, including the garment asset a try-on will actually use
 * and the link to its product page. This is the step that corresponds to
 * walking into the stockroom to look at the real garment before bringing it
 * out: it is where an agent finds out that the colour it was about to promise
 * is not the colour that will render.
 */
export function getPiece(input: { pieceId?: unknown }) {
  const pieceId = typeof input?.pieceId === "string" ? input.pieceId.trim() : "";
  if (!pieceId) {
    return fail("INVALID_INPUT", "pieceId is required.", false);
  }
  const p = getProductById(pieceId);
  if (!p) {
    return fail(
      "UNKNOWN_PIECE",
      "No such piece. Call nude.list_pieces for the nine valid pieceIds.",
      false,
      { pieceId }
    );
  }
  return {
    ok: true as const,
    pieceId: p.id,
    name: p.nameEn,
    nameZh: p.nameZh,
    category: p.category,
    sku: p.sku ?? null,
    price: p.price,
    priceLabel: p.priceLabel,
    colorsAvailableToBuy: p.colors,
    sizes: p.sizes,
    material: p.material,
    description: p.description,
    construction: {
      wire: p.wire,
      cup: p.cup,
      padding: p.padding,
      straps: p.straps,
      closure: p.closure,
      notes: p.structureNotes,
    },
    productUrl: p.productUrl,
    garmentAssets: {
      catalogueImage: p.displayImage,
      renderReference: p.vtoImage,
      note: "renderReference is the single garment image nude.try_on will send to cloth-v4. Whatever colourway it shows is the colourway that will appear on the person, regardless of colorsAvailableToBuy. Look at it, or open productUrl, before you promise a colour.",
    },
    personalImages: PERSONAL_IMAGE,
  };
}

/* ------------------------------------------------------------------ *
 * 3. nude.get_fitting_room_state — read-only
 * ------------------------------------------------------------------ */

/**
 * Everything an agent may know about this fitting room. Deliberately shaped as
 * the redacted view: whether a photo exists, never the photo; which looks were
 * generated and whether each is a real render, never the render.
 */
export function getFittingRoomState() {
  const s = useShowroomStore.getState();
  return {
    hydrated: s.hydrated,
    photo: {
      present: s.personImage !== null,
      savedAt: s.personSavedAt,
      payload: PERSONAL_IMAGE,
      note: "Only the person can add or replace this photo. No tool here can.",
    },
    currentView: s.view,
    selectedPieceId: s.selectedProductId,
    tryOn: { status: s.tryOnStatus, error: s.tryOnError },
    looks: s.looks.map((l) => ({
      lookId: l.id,
      pieceId: l.productId,
      isRealTryOn: l.tryOnIsReal,
      createdAt: l.createdAt,
      friendPickRecordedAt: l.friendPick ?? null,
      partOfPreparation: l.preparedBy?.preparationId ?? null,
      personalImages: PERSONAL_IMAGE,
    })),
    compareLookIds: s.compareIds,
    preparation: currentPreparation(s.looks),
  };
}

/* ------------------------------------------------------------------ *
 * 4. nude.try_on — mutating
 * ------------------------------------------------------------------ */

// A try-on is a real Perfect Corp render against the person's photo; serialise
// them so parallel agent calls cannot race on the selected piece.
let tryOnInFlight = false;

export async function tryOnPiece(input: { pieceId?: unknown }) {
  const pieceId = typeof input?.pieceId === "string" ? input.pieceId.trim() : "";
  if (!pieceId) {
    return fail("INVALID_INPUT", "pieceId is required.", false);
  }

  const before = useShowroomStore.getState();
  if (!before.hydrated) return NOT_HYDRATED();

  if (!getProductById(pieceId)) {
    return fail(
      "UNKNOWN_PIECE",
      "No such piece. Call nude.list_pieces for the nine valid pieceIds.",
      false,
      { pieceId }
    );
  }

  if (!before.personImage) {
    return fail(
      "NO_PHOTO",
      "This fitting room has no photo yet. Only the person can add one, in the browser — no tool here can supply or replace it. Ask her to add a photo, then try again.",
      true,
      { pieceId }
    );
  }

  if (tryOnInFlight) {
    return fail(
      "BUSY",
      "A try-on is already rendering. Wait for it to finish, then call again.",
      true,
      { pieceId }
    );
  }

  tryOnInFlight = true;
  const startedAt = Date.now();
  try {
    // startTryOn selects the piece and shows the try-on view, so the render is
    // visible on screen and the saved look is keyed to the right piece.
    useShowroomStore.getState().startTryOn(pieceId);
    await useShowroomStore.getState().runTryOn(pieceId);
  } finally {
    tryOnInFlight = false;
  }

  const after = useShowroomStore.getState();
  const elapsedMs = Date.now() - startedAt;

  if (after.tryOnIsReal && after.tryOnStatus === "success") {
    const look = after.looks.find((l) => l.productId === pieceId && l.tryOnIsReal);
    return {
      ok: true as const,
      pieceId,
      lookId: look?.id ?? null,
      rendered: "real Perfect Corp cloth-v4 result",
      elapsedMs,
      personalImages: PERSONAL_IMAGE,
    };
  }

  if (after.tryOnStatus === "fallback") {
    return fail(
      "NOT_A_REAL_RENDER",
      "The try-on service is not configured on this deployment, so no real result was produced.",
      false,
      { pieceId, elapsedMs }
    );
  }

  return fail(
    "TRY_ON_FAILED",
    after.tryOnError ?? "The try-on did not complete.",
    true,
    { pieceId, status: after.tryOnStatus, elapsedMs }
  );
}

/* ------------------------------------------------------------------ *
 * 5. nude.prepare_fitting_room — mutating, and the last step
 * ------------------------------------------------------------------ */

/**
 * The handoff, and the last step. Correctness is enforced here rather than
 * hoped for:
 *
 *   - every named piece must ALREADY have a real generated try-on saved, so a
 *     prepared fitting room always contains the actual results;
 *   - every piece must carry its own `why`, so the shortlist cannot be handed
 *     over as three plausible names with one blanket sentence;
 *   - `caveat` exists so an agent that could not confirm something has
 *     somewhere to say it, instead of quietly overclaiming.
 *
 * If it cannot deliver the right result, the right move is to say so here —
 * not to render something that reads as an answer.
 */
export async function prepareFittingRoom(input: {
  brief?: unknown;
  pieces?: unknown;
  caveat?: unknown;
}) {
  const raw = Array.isArray(input?.pieces) ? input.pieces : null;
  if (!raw) {
    return fail(
      "INVALID_INPUT",
      "pieces must be an array of { pieceId, why }. Every piece needs its own reason — one blanket rationale is not accepted.",
      false
    );
  }

  const entries: { pieceId: string; why: string }[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const o = item as { pieceId?: unknown; why?: unknown } | null;
    const pieceId = typeof o?.pieceId === "string" ? o.pieceId.trim() : "";
    const why = typeof o?.why === "string" ? o.why.trim() : "";
    if (!pieceId || !why) {
      return fail(
        "INVALID_INPUT",
        "Each entry needs a pieceId and a non-empty why saying what that piece does for this brief.",
        false,
        { offending: o }
      );
    }
    if (why.length > WHY_MAX) {
      return fail("INVALID_INPUT", `why must be at most ${WHY_MAX} characters.`, false, { pieceId });
    }
    if (seen.has(pieceId)) continue;
    seen.add(pieceId);
    entries.push({ pieceId, why });
  }

  if (entries.length === 0 || entries.length > COMPARE_MAX) {
    return fail(
      "INVALID_INPUT",
      `Name between 1 and ${COMPARE_MAX} distinct pieces.`,
      false,
      { received: entries.length }
    );
  }

  const brief = typeof input?.brief === "string" ? input.brief.trim() : "";
  if (!brief) {
    return fail(
      "INVALID_INPUT",
      "brief is required — restate the task in the person's own words so she recognises it when she comes back.",
      false
    );
  }
  if (brief.length > BRIEF_MAX) {
    return fail("INVALID_INPUT", `brief must be at most ${BRIEF_MAX} characters.`, false);
  }

  const caveatRaw = typeof input?.caveat === "string" ? input.caveat.trim() : "";
  if (caveatRaw.length > CAVEAT_MAX) {
    return fail("INVALID_INPUT", `caveat must be at most ${CAVEAT_MAX} characters.`, false);
  }
  const caveat = caveatRaw || null;

  const s = useShowroomStore.getState();
  if (!s.hydrated) return NOT_HYDRATED();

  const unknown = entries.filter((e) => !getProductById(e.pieceId)).map((e) => e.pieceId);
  if (unknown.length > 0) {
    return fail(
      "UNKNOWN_PIECE",
      "No such piece. Call nude.list_pieces for the nine valid pieceIds.",
      false,
      { unknownPieceIds: unknown }
    );
  }

  // The invariant: a prepared fitting room must actually contain the renders.
  const resolved = entries.map((e) => ({
    ...e,
    look: s.looks.find((l) => l.productId === e.pieceId && l.tryOnIsReal) ?? null,
  }));
  const missing = resolved.filter((r) => r.look === null).map((r) => r.pieceId);
  if (missing.length > 0) {
    return fail(
      "NOT_GENERATED",
      "Every named piece must already have a real generated try-on before the fitting room can be handed over. Run nude.try_on for the missing pieces first, then call this again.",
      true,
      { missingPieceIds: missing }
    );
  }

  await s.prepareFittingRoom(
    resolved.map((r) => ({ lookId: r.look!.id, why: r.why })),
    brief,
    caveat
  );

  return {
    ok: true as const,
    prepared: resolved.length,
    brief,
    caveat,
    pieces: resolved.map((r) => ({ pieceId: r.pieceId, lookId: r.look!.id, why: r.why })),
    sideBySide: resolved.length >= COMPARE_MIN,
    personalImages: PERSONAL_IMAGE,
    handoff:
      "The prepared shortlist, the reason for each piece and any caveat are now waiting in the person's fitting room, alongside the real renders. She decides.",
  };
}
