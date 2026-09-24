import { migrate } from "./sim";
import type { GameState } from "./types";

const KEY = "hansekai24-v1";
const BACKUP = "hansekai24-v1-bak";

export function saveGame(state: GameState) {
  try {
    const blob = JSON.stringify(state);
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BACKUP, prev);
    localStorage.setItem(KEY, blob);
  } catch {
    // private mode / quota — keep playing in memory
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    try {
      const bak = localStorage.getItem(BACKUP);
      if (!bak) return null;
      return migrate(JSON.parse(bak));
    } catch {
      return null;
    }
  }
}

export function hasSave(): boolean {
  try {
    return Boolean(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
