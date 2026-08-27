"use client";

export interface SavedPerson {
  id: string;
  dataUrl: string;
  savedAt: string;
}

/**
 * The handoff an agent leaves behind when it prepares the fitting room:
 * the task in the user's own terms, why these pieces, and when.
 * Written by `nude.prepare_fitting_room`; every look in one preparation
 * shares the same `preparedAt`.
 */
export interface PreparedBy {
  /**
   * Identifies one preparation. Looks are stamped in a single pass, so a
   * timestamp alone is not a safe identifier — two preparations can land in
   * the same millisecond.
   */
  preparationId: string;
  brief: string;
  rationale: string;
  preparedAt: string;
}

export interface SavedLook {
  id: string;
  productId: string;
  imageUrl: string;
  tryOnIsReal: boolean;
  createdAt: string;
  updatedAt: string;
  /** ISO timestamp recorded when the user transcribed a friend's pick for this look. */
  friendPick?: string | null;
  /** Set when an agent handed this look over as part of a prepared shortlist. */
  preparedBy?: PreparedBy | null;
}

const DB_NAME = "nude-virtual-showroom";
const DB_VERSION = 1;
const PERSON_STORE = "person";
const LOOKS_STORE = "looks";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PERSON_STORE)) {
        db.createObjectStore(PERSON_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(LOOKS_STORE)) {
        db.createObjectStore(LOOKS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function runRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = fn(db.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePersonPhoto(dataUrl: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await runRequest(
      db,
      PERSON_STORE,
      "readwrite",
      (store) =>
        store.put({
          id: "default",
          dataUrl,
          savedAt: new Date().toISOString(),
        })
    );
  } finally {
    db.close();
  }
}

export async function loadPersonPhoto(): Promise<SavedPerson | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return (await runRequest(db, PERSON_STORE, "readonly", (store) =>
      store.get("default")
    )) as SavedPerson | null;
  } finally {
    db.close();
  }
}

export async function clearPersonPhoto(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await runRequest(db, PERSON_STORE, "readwrite", (store) => store.delete("default"));
  } finally {
    db.close();
  }
}

export async function loadAllLooks(): Promise<SavedLook[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const looks =
      (await runRequest(db, LOOKS_STORE, "readonly", (store) => store.getAll())) ?? [];
    return looks.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } finally {
    db.close();
  }
}

export async function saveLook(look: SavedLook): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await runRequest(db, LOOKS_STORE, "readwrite", (store) => store.put(look));
  } finally {
    db.close();
  }
}

export async function saveLooks(looks: SavedLook[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await Promise.all(looks.map((look) => runRequest(db, LOOKS_STORE, "readwrite", (store) => store.put(look))));
  } finally {
    db.close();
  }
}

export async function deleteLook(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await runRequest(db, LOOKS_STORE, "readwrite", (store) => store.delete(id));
  } finally {
    db.close();
  }
}

export async function getLookByProductId(productId: string): Promise<SavedLook | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const looks =
      ((await runRequest(db, LOOKS_STORE, "readonly", (store) => store.getAll())) ??
        []) as SavedLook[];
    return looks.find((l) => l.productId === productId && l.tryOnIsReal) ?? null;
  } finally {
    db.close();
  }
}

export async function clearAllLooks(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await runRequest(db, LOOKS_STORE, "readwrite", (store) => store.clear());
  } finally {
    db.close();
  }
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await runRequest(db, PERSON_STORE, "readwrite", (store) => store.clear());
    await runRequest(db, LOOKS_STORE, "readwrite", (store) => store.clear());
  } finally {
    db.close();
  }
}
