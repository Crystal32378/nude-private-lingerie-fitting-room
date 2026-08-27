"use client";

/**
 * Registers NUDE's four fitting-room capabilities on `document.modelContext`
 * so a visitor's own agent can use them.
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

const tryOnInputSchema = {
  type: "object",
  properties: {
    pieceId: {
      type: "string",
      description:
        "A pieceId from nude.list_pieces, e.g. nude-01. One piece per call.",
      pattern: "^nude-[0-9]{2}$",
    },
  },
  required: ["pieceId"],
  additionalProperties: false,
} as const;

const prepareInputSchema = {
  type: "object",
  properties: {
    pieceIds: {
      type: "array",
      description:
        "One to three pieceIds. Each must already have a real generated try-on.",
      items: { type: "string", pattern: "^nude-[0-9]{2}$" },
      minItems: 1,
      maxItems: 3,
    },
    brief: {
      type: "string",
      description:
        "The task restated in the person's own words, so she recognises it when she comes back hours later. E.g. 'Tokyo business trip — under a white shirt'.",
      maxLength: 200,
    },
    rationale: {
      type: "string",
      description:
        "Why these pieces, in one or two sentences she can read at a glance.",
      maxLength: 400,
    },
  },
  required: ["pieceIds", "brief", "rationale"],
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
            "List all nine NUDE pieces with full construction detail — wire, cup, padding, straps, closure, material, colours, sizes and structure notes. Use this to work out which pieces fit a request such as 'nude-toned and smooth under a white shirt'. Returns no images.",
          inputSchema: noInput,
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: () => listPieces(),
        },
        options
      ),
      modelContext.registerTool(
        {
          name: "nude.get_fitting_room_state",
          title: "Read the fitting room",
          description:
            "Read this fitting room's state: whether a photo has been added, which try-ons have been generated and whether each is a real render, the current shortlist, and any preparation already handed over. Never returns the photo or any try-on image.",
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
            "Render one piece onto the photo already stored in this fitting room, using Perfect Corp's cloth-v4 virtual try-on. Takes roughly 10-30 seconds and runs one at a time. Requires that the person has already added a photo — this tool cannot supply or replace it. Returns whether the render succeeded and its lookId, never the image.",
          inputSchema: tryOnInputSchema,
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (input) => tryOnPiece(input as { pieceId?: unknown }),
        },
        options
      ),
      modelContext.registerTool(
        {
          name: "nude.prepare_fitting_room",
          title: "Hand the fitting room over",
          description:
            "The final step. Hand a shortlist of one to three pieces back to the person, together with a brief restating her task and a rationale for the selection, and put them side by side in her fitting room. Refuses unless every named piece already has a real generated try-on, so a prepared fitting room always contains the actual results.",
          inputSchema: prepareInputSchema,
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (input) =>
            prepareFittingRoom(
              input as { pieceIds?: unknown; brief?: unknown; rationale?: unknown }
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
