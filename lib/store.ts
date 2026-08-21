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
  savePersonPhoto,
} from "./storage";

export type View = "showroom" | "product" | "tryon" | "my-looks";

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

  hydrate: () => Promise<void>;
  setView: (view: View) => void;
  openProduct: (id: string) => void;
  backToShowroom: () => void;
  openMyLooks: () => void;
  startTryOn: (id: string) => void;
  backToProduct: () => void;

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

  setPersonImage: async (dataUrl) => {
    // Changing the photo clears all previously saved looks.
    await clearAllLooks();
    await savePersonPhoto(dataUrl);
    const savedAt = new Date().toISOString();
    set({
      personImage: dataUrl,
      personSavedAt: savedAt,
      looks: [],
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
    set({ looks: get().looks.filter((l) => l.id !== id) });
  },

  getCachedLook: (productId) => getLookByProductId(productId),

  clearLocalData: async () => {
    await clearAll();
    set({
      personImage: null,
      personSavedAt: null,
      looks: [],
      tryOnStatus: "idle",
      tryOnImage: null,
      tryOnIsReal: false,
      tryOnError: null,
    });
  },
}));
