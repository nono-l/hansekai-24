import { act, CAVE_FLOORS, createScar, MAX_FLOOR, type Act, type ScarState } from "@/game/scar/run";
import { depositScarSave, noteScarGold } from "@/game/scar/purse";
import { saveGame } from "@/game/save";
import { useGame } from "@/game/store";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

const VIEW_W = 15;
const VIEW_H = 11;

function paint(canvas: HTMLCanvasElement, s: ScarState) {
  const css = getComputedStyle(canvas);
  const bg = css.getPropertyValue("--color-bg").trim() || "#0b0e12";
  const wall = css.getPropertyValue("--color-elevated").trim() || "#1c242e";
  const floor = css.getPropertyValue("--color-border").trim() || "#2a3340";
  const fg = css.getPropertyValue("--color-fg").trim() || "#ece6d8";
  const faint = css.getPropertyValue("--color-faint").trim() || "#6d7680";
  const accent = css.getPropertyValue("--color-accent").trim() || "#7ec8c0";
  const danger = css.getPropertyValue("--color-danger").trim() || "#c45c5c";
  const coin = css.getPropertyValue("--color-coin").trim() || "#c4a15c";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cell = Math.floor(Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H));
  const ox = Math.floor((canvas.width - cell * VIEW_W) / 2);
  const oy = Math.floor((canvas.height - cell * VIEW_H) / 2);
  const x0 = Math.max(0, Math.min(s.w - VIEW_W, s.px - (VIEW_W >> 1)));
  const y0 = Math.max(0, Math.min(s.h - VIEW_H, s.py - (VIEW_H >> 1)));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${Math.floor(cell * 0.62)}px "Zen Kaku Gothic New", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let vy = 0; vy < VIEW_H; vy++) {
    for (let vx = 0; vx < VIEW_W; vx++) {
      const x = x0 + vx;
      const y = y0 + vy;
      if (x >= s.w || y >= s.h) continue;
      const i = y * s.w + x;
      const seen = s.seen[i] === 1;
      if (!seen) continue;
      const vis = s.visible[i] === 1;
      const t = s.tiles[i] ?? 0;
      ctx.globalAlpha = vis ? 1 : 0.38;
      ctx.fillStyle = t === 0 ? wall : floor;
      ctx.fillRect(ox + vx * cell, oy + vy * cell, cell - 1, cell - 1);
      if (t === 2) {
        ctx.fillStyle = accent;
        ctx.fillRect(ox + vx * cell + cell * 0.28, oy + vy * cell + cell * 0.28, cell * 0.44, cell * 0.44);
      }
    }
  }
  const glyph = (x: number, y: number, text: string, color: string, vis: boolean) => {
    const vx = x - x0;
    const vy = y - y0;
    if (vx < 0 || vy < 0 || vx >= VIEW_W || vy >= VIEW_H) return;
    ctx.globalAlpha = vis ? 1 : 0.38;
    ctx.fillStyle = color;
    ctx.fillText(text, ox + vx * cell + cell / 2, oy + vy * cell + cell / 2);
  };
  for (const p of s.piles) {
    const vis = s.visible[p.y * s.w + p.x] === 1;
    const seen = s.seen[p.y * s.w + p.x] === 1;
    if (!seen) continue;
    glyph(p.x, p.y, p.kind === "gold" ? "金" : "薬", p.kind === "gold" ? coin : accent, vis);
  }
  for (const m of s.mobs) {
    if (m.hp <= 0) continue;
    const vis = s.visible[m.y * s.w + m.x] === 1;
    if (!vis) continue;
    glyph(m.x, m.y, m.boss ? "爪" : m.name.slice(0, 1), m.boss ? danger : coin, true);
  }
  glyph(s.px, s.py, "勇", fg, true);
  ctx.globalAlpha = 1;
  void faint;
}

function bank(amount: number) {
  const n = Math.max(0, Math.floor(amount));
  if (!n) return 0;
  const live = useGame.getState().game;
  if (live) {
    const next = noteScarGold(live, n);
    saveGame(next);
    useGame.setState({ game: next, saved: true });
    return next.gold;
  }
  return depositScarSave(n);
}

export function ScarDungeon() {
  const [run, setRun] = useState<ScarState | null>(null);
  const [banked, setBanked] = useState(0);
  const [left, setLeft] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const paid = useRef(false);
  const playing = useRef(false);

  playing.current = !!run && run.over === "play" && !left;

  useEffect(() => {
    if (!run || !canvas.current) return;
    paint(canvas.current, run);
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Act> = {
        ArrowUp: "n",
        ArrowDown: "s",
        ArrowLeft: "w",
        ArrowRight: "e",
        w: "n",
        W: "n",
        s: "s",
        S: "s",
        a: "w",
        A: "w",
        d: "e",
        D: "e",
        " ": "wait",
      };
      const actName = map[e.key];
      if (!actName || !playing.current) return;
      e.preventDefault();
      setRun((cur) => (cur && cur.over === "play" ? act(cur, actName) : cur));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (a: Act) => {
    if (!playing.current) return;
    setRun((cur) => (cur && cur.over === "play" ? act(cur, a) : cur));
  };

  const finish = (keep: number) => {
    if (paid.current) return;
    paid.current = true;
    setBanked(bank(keep));
    setLeft(true);
  };

  useEffect(() => {
    if (!run || run.over === "play") return;
    const keep = run.over === "dead" ? Math.floor(run.gold * 0.4) : run.gold;
    finish(keep);
  }, [run]);

  if (!run) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-5">
        <p className="text-[11px] tracking-[0.22em] text-accent">月詠が開けた穴</p>
        <h1 className="font-display text-3xl text-fg">魔王の爪痕</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          表向きは、かつての勇者の洞窟。四階で終わる、と誰もが思っている。金と薬を拾い、途中でも引き上げられる。死ねば、持っていた金の四割だけが店へ戻る。
        </p>
        <button
          type="button"
          className="mt-6 h-11 rounded-md bg-accent text-sm text-accent-fg"
          onClick={() => setRun(createScar())}
        >
          降りる
        </button>
        <Link to="/tsukuyo" className="mt-4 text-sm text-muted">
          写真集へ戻る
        </Link>
      </main>
    );
  }

  const salvage = run.over === "dead" ? Math.floor(run.gold * 0.4) : run.gold;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3 py-3">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-accent">
            {run.floor <= CAVE_FLOORS ? `かつての勇者の洞窟 · ${run.floor} / ${CAVE_FLOORS}` : `${run.floor} / ${MAX_FLOOR}`}
          </p>
          <h1 className="font-display text-2xl text-fg">{run.floor <= CAVE_FLOORS ? "勇者の洞窟" : "魔王の爪痕"}</h1>
        </div>
        <Link to="/tsukuyo" className="mb-1 text-sm text-muted">
          戻る
        </Link>
      </header>
      <p className="mt-2 text-sm text-fg">
        傷 {run.hp}/{run.maxHp}　刃 {run.atk}　金 {run.gold}　薬 {run.pot}
      </p>
      <canvas ref={canvas} className="mt-3 h-[52dvh] w-full rounded-md border border-border bg-bg" />
      <ul className="mt-2 min-h-16 space-y-0.5 text-xs leading-relaxed text-muted">
        {run.log.slice(0, 4).map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
      {run.over === "play" && !left ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <span />
          <button type="button" className="h-11 rounded-md border border-border text-sm" onClick={() => go("n")}>
            北
          </button>
          <span />
          <button type="button" className="h-11 rounded-md border border-border text-sm" onClick={() => go("w")}>
            西
          </button>
          <button type="button" className="h-11 rounded-md border border-border text-sm" onClick={() => go("wait")}>
            待つ
          </button>
          <button type="button" className="h-11 rounded-md border border-border text-sm" onClick={() => go("e")}>
            東
          </button>
          <button type="button" className="h-11 rounded-md border border-border text-sm" onClick={() => go("potion")}>
            薬
          </button>
          <button type="button" className="h-11 rounded-md border border-border text-sm" onClick={() => go("s")}>
            南
          </button>
          <button type="button" className="h-11 rounded-md bg-accent text-sm text-accent-fg" onClick={() => finish(run.gold)}>
            引き上げ
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-border bg-surface p-4">
          <p className="font-display text-xl text-fg">{run.over === "dead" ? "沈んだ" : run.over === "clear" ? "爪の底" : "引き上げた"}</p>
          <p className="mt-2 text-sm text-muted">
            {run.over === "dead"
              ? `持ち金 ${run.gold} のうち ${salvage}G だけ、爪の外へ出る。`
              : `${salvage}G を、店の引き出しへ戻した。`}
          </p>
          {left ? <p className="mt-3 text-sm text-fg">引き出しは {banked}G。</p> : null}
        </div>
      )}
    </main>
  );
}
