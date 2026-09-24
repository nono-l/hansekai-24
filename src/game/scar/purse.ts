import { loadGame, saveGame } from "../save";
import type { GameState } from "../types";

const PENDING = "hansekai24-scar-purse";

export function noteScarGold(g: GameState, amount: number): GameState {
  const n = Math.max(0, Math.floor(amount));
  if (!n) return g;
  const news = g.news ? g.news.slice() : [];
  const newsId = (g.newsId ?? 0) + 1;
  news.unshift({
    id: newsId,
    day: g.day,
    hour: g.hour,
    text: `魔王の爪痕から、${n}Gを引き上げた。`,
    tone: "ok",
  });
  if (news.length > 40) news.length = 40;
  return { ...g, gold: g.gold + n, newsId, news };
}

export function stashScarGold(amount: number) {
  const n = Math.max(0, Math.floor(amount));
  if (!n) return;
  try {
    const prev = Number(localStorage.getItem(PENDING) || 0);
    localStorage.setItem(PENDING, String((Number.isFinite(prev) ? prev : 0) + n));
  } catch {
    // private mode
  }
}

export function takeScarStash(): number {
  try {
    const n = Number(localStorage.getItem(PENDING) || 0);
    if (!n) return 0;
    localStorage.removeItem(PENDING);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function depositScarSave(amount: number): number {
  const n = Math.max(0, Math.floor(amount));
  if (!n) return 0;
  const loaded = loadGame();
  if (!loaded) {
    stashScarGold(n);
    return n;
  }
  const next = noteScarGold(loaded, n);
  saveGame(next);
  return next.gold;
}
