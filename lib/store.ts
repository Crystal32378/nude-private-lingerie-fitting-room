"use client";

import { create } from "zustand";
import {
  SavedLook,
  clearAll,
  clearAllLooks,
  clearPersonPhoto,
  deleteLook as dbDeleteLook,
  getLookByProductId,
  loadAllLooks,
  loadPersonPhoto,
  saveLook as dbSaveLook,
  saveLooks as dbSaveLooks,
  savePersonPhoto,
} from "./storage";

export type View = "showroom" | "product" | "tryon" | "my-looks" | "compare";

/** Compare supports two or three looks, labelled A/B/C in selection order. */
export const COMPARE_MIN = 2;
export const COMPARE_MAX = 3;

export type TryOnStatus = "idle" | "loading" | "success" | "error" | "demo" | "fallback";

interface ShowroomState {
  view: View;
  selectedProductId: string | null;
  personImage: string | null;
  personSavedAt: string | null;
  tryOnStatus: TryOnStatus;
  tryOnImage: string | null;
  tryOnIsReal: boolean;
  tryOnError: string | null;
  looks: SavedLook[];
  hydrated: boolean;
  /** Saved-look ids chosen for side-by-side compare, in A/B/C order. */
  compareIds: string[];

  hydrate: () => Promise<void>;
  setView: (view: View) => void;
  openProduct: (id: string) => void;
  backToShowroom: () => void;
  openMyLooks: () => void;
  startTryOn: (id: string) => void;
  backToProduct: () => void;

  toggleCompare: (lookId: string) => void;
  clearCompare: () => void;
  enterCompare: () => void;
  exitCompare: () => void;
  recordFriendPick: (lookId: string) => Promise<void>;

  setPersonImage: (dataUrl: string) => Promise<void>;
  clearPerson: () => Promise<void>;

  setTryOnLoading: () => void;
  setTryOnSuccess: (image: string, isReal: boolean) => void;
  setTryOnError: (message: string) => void;
  resetTryOn: () => void;

  saveCurrentLook: () => Promise<void>;
  removeLook: (id: string) => Promise<void>;
  getCachedLook: (productId: string) => Promise<SavedLook | null>;
  clearLocalData: () => Promise<void>;
}

export const useShowroomStore = create<ShowroomState>((set, get) => ({
  view: "showroom",
  selectedProductId: null,
  personImage: null,
  personSavedAt: null,
  tryOnStatus: "idle",
  tryOnImage: null,
  tryOnIsReal: false,
  tryOnError: null,
  looks: [],
  hydrated: false,
  compareIds: [],

  hydrate: async () => {
    const [person, looks] = await Promise.all([loadPersonPhoto(), loadAllLooks()]);
    set({
      personImage: person?.dataUrl ?? null,
      personSavedAt: person?.savedAt ?? null,
      looks,
      hydrated: true,
    });
  },

  setView: (view) => set({ view }),

  openProduct: (id) =>
    set({
      view: "product",
      selectedProductId: id,
      tryOnStatus: "idle",
      tryOnImage: null,
      tryOnIsReal: false,
      tryOnError: null,
    }),

  backToShowroom: () => set({ view: "showroom" }),

  openMyLooks: () => set({ view: "my-looks" }),

  startTryOn: (id) =>
    set({
      view: "tryon",
      selectedProductId: id,
      tryOnStatus: "idle",
      tryOnImage: null,
      tryOnIsReal: false,
      tryOnError: null,
    }),

  backToProduct: () => set({ view: "product" }),

  toggleCompare: (lookId) => {
    const { compareIds } = get();
    if (compareIds.includes(lookId)) {
      set({ compareIds: compareIds.filter((id) => id !== lookId) });
      return;
    }
    if (compareIds.length >= COMPARE_MAX) return;
    set({ compareIds: [...compareIds, lookId] });
  },

  clearCompare: () => set({ compareIds: [] }),

  enterCompare: () => {
    const { compareIds, looks } = get();
    // Drop ids whose looks were deleted since selection.
    const valid = compareIds.filter((id) => looks.some((l) => l.id === id));
    if (valid.length < COMPARE_MIN) {
      set({ compareIds: valid });
      return;
    }
    set({ compareIds: valid.slice(0, COMPARE_MAX), view: "compare" });
  },

  exitCompare: () => set({ view: "my-looks" }),

  recordFriendPick: async (lookId) => {
    const current = get().looks.find((l) => l.id === lookId);
    if (!current) return;
    // One live pick at a time: stamp the chosen look, clear it everywhere else.
    const changed: SavedLook[] = [];
    const next = get().looks.map((look) => {
      const picked = look.id === lookId;
      const friendPick = picked ? new Date().toISOString() : null;
      if ((look.friendPick ?? null) === friendPick) return look;
      const updated = { ...look, friendPick };
      changed.push(updated);
      return updated;
    });
    await dbSaveLooks(changed);
    set({ looks: next });
  },

  setPersonImage: async (dataUrl) => {
    // Changing the photo clears all previously saved looks.
    await clearAllLooks();
    await savePersonPhoto(dataUrl);
    const savedAt = new Date().toISOString();
    set({
      personImage: dataUrl,
      personSavedAt: savedAt,
      looks: [],
      compareIds: [],
    });
  },

  clearPerson: async () => {
    await clearPersonPhoto();
    set({ personImage: null, personSavedAt: null });
  },

  setTryOnLoading: () => set({ tryOnStatus: "loading", tryOnError: null }),

  setTryOnSuccess: (image, isReal) =>
    set({ tryOnStatus: isReal ? "success" : "fallback", tryOnImage: image, tryOnIsReal: isReal }),

  setTryOnError: (message) => set({ tryOnStatus: "error", tryOnError: message }),

  resetTryOn: () =>
    set({
      tryOnStatus: "idle",
      tryOnImage: null,
      tryOnIsReal: false,
      tryOnError: null,
    }),

  saveCurrentLook: async () => {
    const { selectedProductId, tryOnImage, tryOnIsReal, looks } = get();
    if (!selectedProductId || !tryOnImage) return;
    // Keep only the latest look per product.
    const filtered = looks.filter((l) => l.productId !== selectedProductId);
    const now = new Date().toISOString();
    const look: SavedLook = {
      id: `look-${selectedProductId}-${Date.now()}`,
      productId: selectedProductId,
      imageUrl: tryOnImage,
      tryOnIsReal,
      createdAt: now,
      updatedAt: now,
    };
    await dbSaveLook(look);
    set({ looks: [look, ...filtered] });
  },

  removeLook: async (id) => {
    await dbDeleteLook(id);
    set({
      looks: get().looks.filter((l) => l.id !== id),
      compareIds: get().compareIds.filter((cid) => cid !== id),
    });
  },

  getCachedLook: (productId) => getLookByProductId(productId),

  clearLocalData: async () => {
    await clearAll();
    set({
      personImage: null,
      personSavedAt: null,
      looks: [],
      compareIds: [],
      tryOnStatus: "idle",
      tryOnImage: null,
      tryOnIsReal: false,
      tryOnError: null,
    });
  },
}));
