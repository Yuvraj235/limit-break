import { STORAGE_PREFIX } from '../config.js';

// localStorage can be missing or throw (private mode, blocked site data); never let that break the game.
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
  },
  remove(key) {
    try { localStorage.removeItem(STORAGE_PREFIX + key); } catch { /* ignore */ }
  },
};
