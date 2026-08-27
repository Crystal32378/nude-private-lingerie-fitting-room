"use client";

/**
 * Registers NUDE's four fitting-room capabilities on `document.modelContext`
 * so a visitor's own agent can use them.
 *
 * No photo of the person and no try-on result is returned through these tools.
 * That is a property of this interface only — rendering a fitting still sends
 * the photo to Perfect Corp's YouCam service, as the README's Privacy section
 * documents. Garment imagery and product pages ARE exposed, on purpose: they
 * are NUDE's own public product photography, and an agent needs them to know
 * what it is about to render.
 *
 * The tools are shaped for correctness over speed. A fitting room is finished
 * work, not a fast answer.
 *
 * WebMCP is a proposed standard (W3C Web Machine Learning CG). The imperative
 * API lives on `document.modelContext` — it moved there from `navigator` in
 * May 2026, and there is no `unregisterTool`: aborting the signal passed to
 * `registerTool` is how tools are withdrawn. Unsupported browsers no-op, so
 * the storefront is unchanged for everyone else.
 *
 * Test with ChatGPT desktop's in-app browser, or Chrome 149+ with
 * chrome://flags/#enable-webmcp-testing enabled.
 */

import { useEffect } from "react";
import {
  getFittingRoomState,
  getPiece,
  listPieces,
  prepareFittingRoom,
  tryOnPiece,
} from "@/lib/webmcp/capabilities";

interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: ToolAnnotations;
  execute(input: object): Promise<unknown> | unknown;
}

interface ModelContext {
  registerTool(
    tool: ModelContextTool,
    options?: { signal?: AbortSignal }
  ): Promise<void>;
}

const noInput = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const pieceIdInputSchema = {
  type: "object",
  properties: {
    pieceId: {
      type: "string",
      description: "A pieceId from nude.list_pieces, e.g. nude-01.",
      pattern: "^nude-[0-9]{2}$",
    },
  },
  required: ["pieceId"],
  additionalProperties: false,
} as const;

const tryOnInputSchema = {
  type: "object",
  properties: {
    pieceId: {
      type: "string",
      description:
        "A pieceId from nude.list_pieces, e.g. nude-01. One piece per call.",
      pattern: "^nude-[0-9]{2}$",
    },
    colour: {
      type: "string",
      description:
        "Optional. A colourway from that piece's coloursYouCanRender. Omit to use the default reference, whose colourway is unlabelled. Asking for a colour outside coloursYouCanRender is refused rather than substituted.",
      maxLength: 32,
    },
  },
  required: ["pieceId"],
  additionalProperties: false,
} as const;

const prepareInputSchema = {
  type: "object",
  properties: {
    brief: {
      type: "string",
      description:
        "The task restated in the person's own words, so she recognises it when she comes back hours later. E.g. 'Tokyo business trip — under a white shirt'.",
      maxLength: 200,
    },
    pieces: {
      type: "array",
      description:
        "One to three pieces, in the order you want her to see them. Each must already have a real generated try-on, and each needs its own reason — one blanket rationale for the set is not accepted.",
      items: {
        type: "object",
        properties: {
          pieceId: { type: "string", pattern: "^nude-[0-9]{2}$" },
          why: {
            type: "string",
            description:
              "What this specific piece does for this brief. Cite the construction detail you relied on, not a general impression.",
            maxLength: 200,
          },
        },
        required: ["pieceId", "why"],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: 3,
    },
    caveat: {
      type: "string",
      description:
        "Anything you could not confirm — a colour the render cannot honour, a requirement only partly met, a piece included as the nearest available option, a requirement that strictly only one piece meets. Say all of it here rather than overclaiming. There is room; use it.",
      maxLength: 700,
    },
  },
  required: ["brief", "pieces"],
  additionalProperties: false,
} as const;

export function ModelContextTools() {
  useEffect(() => {
    const { modelContext } = document as unknown as {
      readonly modelContext?: ModelContext;
    };
    if (typeof modelContext?.registerTool !== "function") return;

    // Aborting this signal unregisters every tool when the component unmounts.
    const controller = new AbortController();
    const options = { signal: controller.signal };

    void Promise.all([
      modelContext.registerTool(
        {
          name: "nude.list_pieces",
          title: "Browse the NUDE collection",
          description:
            "List all nine NUDE pieces with full construction detail — wire, cup, padding, straps, closure, material, colours, sizes and structure notes. Use this to work out which pieces fit a request such as 'nude-toned and smooth under a white shirt'. Returns no image data.",
          inputSchema: noInput,
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: () => listPieces(),
        },
        options
      ),
      modelContext.registerTool(
        {
          name: "nude.get_piece",
          title: "Look at one piece properly",
          description:
            "Open one piece in full: construction detail, sizes, description, its product page URL, and the actual garment image a try-on will send to cloth-v4. This is the step where you find out whether the colour you were about to promise is the colour that will render. Use it on every piece you are seriously considering before you render anything.",
          inputSchema: pieceIdInputSchema,
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input) => getPiece(input as { pieceId?: unknown }),
        },
        options
      ),
      modelContext.registerTool(
        {
          name: "nude.get_fitting_room_state",
          title: "Read the fitting room",
          description:
            "Read this fitting room's state: whether a photo has been added, which try-ons have been generated and whether each is a real render, the current shortlist, and any preparation already handed over. Returns no image data.",
          inputSchema: noInput,
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: () => getFittingRoomState(),
        },
        options
      ),
      modelContext.registerTool(
        {
          name: "nude.try_on",
          title: "Try a piece on",
          description:
            "Render one piece onto the photo already stored in this fitting room, using Perfect Corp's cloth-v4 virtual try-on. Takes roughly 10-30 seconds and runs one at a time. Pass a colour from that piece's coloursYouCanRender to render that colourway; omit it for the unlabelled default. A colour that cannot be rendered is refused, never substituted. Requires that the person has already added a photo — this tool cannot supply or replace it. Returns whether the render succeeded and its lookId, and no image data.",
          inputSchema: tryOnInputSchema,
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (input) => tryOnPiece(input as { pieceId?: unknown; colour?: unknown }),
        },
        options
      ),
      modelContext.registerTool(
        {
          name: "nude.prepare_fitting_room",
          title: "Hand the fitting room over",
          description:
            "The final step, once the fitting room is actually right. Hand back one to three pieces, each with its own reason, plus a brief restating her task and an optional caveat for anything you could not confirm. Refuses unless every named piece already has a real generated try-on and its own why — a prepared fitting room always contains the real results and a per-piece justification, never three plausible names. Getting here slowly is correct; getting here with the wrong pieces is not.",
          inputSchema: prepareInputSchema,
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (input) =>
            prepareFittingRoom(
              input as { brief?: unknown; pieces?: unknown; caveat?: unknown }
            ),
        },
        options
      ),
    ]).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      controller.abort();
      console.error("WebMCP tool registration failed", error);
    });

    return () => controller.abort();
  }, []);

  return null;
}
