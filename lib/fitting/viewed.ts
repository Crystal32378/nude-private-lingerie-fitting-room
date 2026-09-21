/**
 * Which pieces she opened in the showroom, for this browser tab only.
 * Product ids, never her words or photos. Stays on the device; never sent to JEV.
 * In a physical store the piece she picked up is where the conversation starts.
 */
const KEY = "nude.viewedInShowroom";

export function recordViewed(productId: string): void {
  try {
    const ids = readViewed();
    if (!ids.includes(productId)) sessionStorage.setItem(KEY, JSON.stringify([...ids, productId]));
  } catch { /* storage unavailable: the fitting room simply has no showroom signal */ }
}

export function readViewed(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}
