"use client";

/**
 * The four capabilities NUDE exposes to a visitor's own agent over WebMCP.
 *
 * One rule governs every return value in this file: **no pixels leave.** The
 * person photo and every generated try-on image stay in this browser's
 * IndexedDB and on the screen. An agent can decide what to try, trigger a real
 * Perfect Corp `cloth-v4` render, learn that it finished, and hand a prepared
 * shortlist back to the person — without the imagery ever entering its context.
 *
 * `IMAGE_PAYLOAD` is returned in place of any image field so the absence is
 * explicit in the tool result rather than merely implied by omission.
 */

import { NUDE_PRODUCTS, PRODUCT_COUNT, getProductById } from "@/lib/products";
import {
  COMPARE_MAX,
  COMPARE_MIN,
  currentPreparation,
  useShowroomStore,
} from "@/lib/store";

export const IMAGE_PAYLOAD =
  "not returned — the photo and every try-on image stay in this browser" as const;

const BRIEF_MAX = 200;
const RATIONALE_MAX = 400;

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
    imagePayload: IMAGE_PAYLOAD,
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
    })),
  };
}

/* ------------------------------------------------------------------ *
 * 2. nude.get_fitting_room_state — read-only
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
      payload: IMAGE_PAYLOAD,
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
      chosenByUserAt: l.friendPick ?? null,
      partOfPreparation: l.preparedBy?.preparationId ?? null,
      imagePayload: IMAGE_PAYLOAD,
    })),
    compareLookIds: s.compareIds,
    preparation: currentPreparation(s.looks),
  };
}

/* ------------------------------------------------------------------ *
 * 3. nude.try_on — mutating
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
      imagePayload: IMAGE_PAYLOAD,
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
 * 4. nude.prepare_fitting_room — mutating, and the last step
 * ------------------------------------------------------------------ */

/**
 * The handoff. Understanding has to become delivery: this refuses unless every
 * named piece *already* has a real generated try-on saved. It cannot be used to
 * announce "I picked three for you" while the renders are missing, incomplete,
 * or attached to the wrong piece.
 */
export async function prepareFittingRoom(input: {
  pieceIds?: unknown;
  brief?: unknown;
  rationale?: unknown;
}) {
  const raw = Array.isArray(input?.pieceIds) ? input.pieceIds : null;
  if (!raw) {
    return fail("INVALID_INPUT", "pieceIds must be an array of pieceId strings.", false);
  }
  const pieceIds = Array.from(
    new Set(raw.filter((v): v is string => typeof v === "string").map((v) => v.trim()))
  ).filter(Boolean);

  if (pieceIds.length === 0 || pieceIds.length > COMPARE_MAX) {
    return fail(
      "INVALID_INPUT",
      `Name between 1 and ${COMPARE_MAX} distinct pieces.`,
      false,
      { received: pieceIds.length }
    );
  }

  const brief = typeof input?.brief === "string" ? input.brief.trim() : "";
  const rationale = typeof input?.rationale === "string" ? input.rationale.trim() : "";
  if (!brief || !rationale) {
    return fail(
      "INVALID_INPUT",
      "Both brief and rationale are required. brief restates the task in the person's own words; rationale says why these pieces.",
      false
    );
  }
  if (brief.length > BRIEF_MAX || rationale.length > RATIONALE_MAX) {
    return fail(
      "INVALID_INPUT",
      `brief must be at most ${BRIEF_MAX} characters and rationale at most ${RATIONALE_MAX}.`,
      false
    );
  }

  const s = useShowroomStore.getState();
  if (!s.hydrated) return NOT_HYDRATED();

  const unknown = pieceIds.filter((id) => !getProductById(id));
  if (unknown.length > 0) {
    return fail(
      "UNKNOWN_PIECE",
      "No such piece. Call nude.list_pieces for the nine valid pieceIds.",
      false,
      { unknownPieceIds: unknown }
    );
  }

  // The invariant: a prepared fitting room must actually contain the renders.
  const resolved = pieceIds.map((pieceId) => ({
    pieceId,
    look: s.looks.find((l) => l.productId === pieceId && l.tryOnIsReal) ?? null,
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

  const lookIds = resolved.map((r) => r.look!.id);
  await s.prepareFittingRoom(lookIds, brief, rationale);

  return {
    ok: true as const,
    prepared: lookIds.length,
    lookIds,
    pieceIds,
    brief,
    rationale,
    sideBySide: lookIds.length >= COMPARE_MIN,
    imagePayload: IMAGE_PAYLOAD,
    handoff:
      "The prepared shortlist and this note are now waiting in the person's fitting room. She decides.",
  };
}
