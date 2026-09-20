/** Per-NPC affection, scoped like memory: npc_id + oc_id. */
const STORAGE_KEY = "oc_game_npc_affection_v1";
const DEFAULT_AFFECTION = 10;
const MIN_AFFECTION = 0;
const MAX_AFFECTION = 100;

export type AffectionScope = {
  npc_id: string;
  oc_id: string;
};

export type AffectionStore = Record<string, number>;

function scopeKey(scope: AffectionScope): string {
  return `${scope.npc_id}::${scope.oc_id}`;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AFFECTION;
  return Math.max(MIN_AFFECTION, Math.min(MAX_AFFECTION, Math.round(value)));
}

function readStore(): AffectionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: AffectionStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) out[key] = clamp(value);
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: AffectionStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export const Affection = {
  key: STORAGE_KEY,
  defaultValue: DEFAULT_AFFECTION,

  getAll(): AffectionStore {
    return readStore();
  },

  replaceAll(store: AffectionStore) {
    const next: AffectionStore = {};
    for (const [key, value] of Object.entries(store || {})) {
      if (typeof value === "number" && Number.isFinite(value)) next[key] = clamp(value);
    }
    writeStore(next);
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },

  get(scope: AffectionScope, fallback = DEFAULT_AFFECTION): number {
    const store = readStore();
    const key = scopeKey(scope);
    if (Object.prototype.hasOwnProperty.call(store, key)) return store[key];
    return clamp(fallback);
  },

  set(scope: AffectionScope, value: number): number {
    const store = readStore();
    const next = clamp(value);
    store[scopeKey(scope)] = next;
    writeStore(store);
    return next;
  },

  adjust(scope: AffectionScope, delta: number, fallback = DEFAULT_AFFECTION): number {
    const current = this.get(scope, fallback);
    return this.set(scope, current + (Number.isFinite(delta) ? delta : 0));
  },
};
