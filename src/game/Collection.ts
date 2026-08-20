export interface CollectedGeode {
  variety: string;
  seed: number;
  /** 0..1 — how thoroughly the stone was washed and dusted. */
  care: number;
  at: number;
}

const KEY = 'pakatto-geode-collection-v1';
const MAX = 60;

/** localStorage can be unavailable (private mode, storage full). The gallery is
 *  a nicety, so every failure degrades to an in-memory list rather than an error. */
let memory: CollectedGeode[] | null = null;

export function loadCollection(): CollectedGeode[] {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as CollectedGeode[]) : [];
  } catch {
    memory = [];
  }
  if (!Array.isArray(memory)) memory = [];
  return memory;
}

export function addToCollection(entry: CollectedGeode): CollectedGeode[] {
  const list = loadCollection();
  list.unshift(entry);
  if (list.length > MAX) list.length = MAX;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* keep the in-memory copy */
  }
  return list;
}

export function clearCollection(): void {
  memory = [];
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
