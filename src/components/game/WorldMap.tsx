import { useEffect, useRef, type MouseEvent } from "react";
import { DENS, DEN_IDS, FACTIONS, maxAttract, WARLORDS } from "@/game/data";
import {
  buildMapField,
  cellColor,
  denToCell,
  MAP_COLS,
  MAP_ROWS,
  nearestDen,
  storeRadius,
  type MapField,
} from "@/game/mapField";
import { useGame } from "@/game/store";
import type { DenId } from "@/game/types";
import { cn } from "@/lib/cn";

export function WorldMap() {
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.ui.selectedDen);
  const selectDen = useGame((s) => s.selectDen);
  const attract = useGame((s) => s.attract);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let alive = true;
    let last = performance.now();
    let field: MapField | null = null;
    let fieldKey = "";
    const shown = new Float32Array(MAP_COLS * MAP_ROWS);
    let booted = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const draw = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const g = useGame.getState().game;
      const sel = useGame.getState().ui.selectedDen;
      if (!g) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const densKey = DEN_IDS.map((id) => g.dens[id]).join("");
      const facKey = `${g.facilities.lighting}${g.facilities.delivery}${g.facilities.wyvern}${g.facilities.golem}${g.facilities.hotcase}${g.facilities.register}${g.facilities.atm}${g.facilities.warehouse}`;
      const key = `${g.day}|${g.hour}|${densKey}|${facKey}|${Math.round(g.warHeat)}|${g.warContract}|${g.caveKnown}|${g.caveSealed}|${g.campaign}|${g.guestsToday}`;
      if (key !== fieldKey) {
        field = buildMapField(g);
        fieldKey = key;
        if (!booted) {
          if (reduce) shown.set(field.glow);
          booted = true;
        }
      }
      if (!field) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const rate = reduce ? 20 : 2.2;
      const k = 1 - Math.exp(-dt * rate);
      for (let i = 0; i < shown.length; i++) {
        shown[i] += (field.glow[i] - shown[i]) * k;
      }

      const rect = wrap.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cellW = w / MAP_COLS;
      const cellH = h / MAP_ROWS;
      const gapX = cellW * 0.1;
      const gapY = cellH * 0.1;
      const sizeX = Math.max(1.1, cellW - gapX);
      const sizeY = Math.max(1.1, cellH - gapY);
      const pulse = reduce ? 1 : 0.5 + 0.5 * Math.sin(now / 420);
      const selCell = denToCell(sel);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0b0e12";
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#2a3340";
      for (let c = 0; c < MAP_COLS; c += 8) {
        ctx.fillRect(c * cellW, 0, 1, h);
      }
      for (let r = 0; r < MAP_ROWS; r += 8) {
        ctx.fillRect(0, r * cellH, w, 1);
      }
      ctx.globalAlpha = 1;

      for (let r = 0; r < MAP_ROWS; r++) {
        for (let c = 0; c < MAP_COLS; c++) {
          const i = r * MAP_COLS + c;
          const distSel = Math.hypot(c - selCell.c, r - selCell.r);
          const selectedGlow = distSel < 3.2 ? (1 - distSel / 3.2) * pulse : 0;
          const [cr, cg, cb, a] = cellColor(field, i, g.hour, pulse, selectedGlow);
          const lit = field.zone[i] !== 0 || field.glow[i] > 0.08;
          const target = Math.max(0.2, field.glow[i]);
          const vis = lit ? a * (0.7 + 0.3 * Math.min(1, shown[i] / target)) : a;
          ctx.globalAlpha = vis;
          ctx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
          const x = c * cellW + gapX / 2;
          const y = r * cellH + gapY / 2;
          ctx.beginPath();
          ctx.roundRect(x, y, sizeX, sizeY, Math.min(sizeX, sizeY) * 0.38);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  if (!game) return null;
  const selectedId = selected;
  const den = DENS[selectedId];
  const lv = game.dens[selectedId];
  const cost = Math.round(den.cost * (1 + lv * 0.7));
  const cap = maxAttract(game.era);
  const maxed = lv >= cap;
  const lockedClaw = selectedId === "claw" && lv === 0 && game.facilities.wyvern <= 0;
  const rumorHollow = selectedId === "hollow" && !game.caveKnown;
  const sealedHollow = selectedId === "hollow" && game.caveSealed;
  const lamp = storeRadius(game);

  const onMapClick = (e: MouseEvent<HTMLElement>) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cellW = rect.width / MAP_COLS;
    const cellH = rect.height / MAP_ROWS;
    const c = (e.clientX - rect.left) / cellW;
    const r = (e.clientY - rect.top) / cellH;
    const hit = nearestDen(c, r, game);
    if (hit) selectDen(hit);
  };

  return (
    <section ref={wrapRef} className="absolute inset-0 overflow-hidden bg-bg" onClick={onMapClick}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-bg/70 to-transparent" />
      <p className="pointer-events-none absolute left-3 top-3 font-display text-sm tracking-wide text-fg/80">
        アレスガルド · 兵站ドット図
      </p>
      <ul className="pointer-events-none absolute right-3 top-3 flex max-w-[70%] flex-wrap justify-end gap-x-2 gap-y-1 text-[10px] text-faint">
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px] bg-accent" />
          店の灯
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px] bg-warn" />
          兵站路
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px] bg-danger" />
          戦火
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px]" style={{ background: "#3a4e44" }} />
          野
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px]" style={{ background: "#2e7652" }} />
          沼
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px]" style={{ background: "#34609e" }} />
          海
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px]" style={{ background: "#94b0c4" }} />
          氷
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px]" style={{ background: "#846c56" }} />
          山
        </li>
        <li className="flex items-center gap-1">
          <span className="size-1.5 rounded-[1px]" style={{ background: "#9c603e" }} />
          荒野
        </li>
      </ul>
      {DEN_IDS.map((id) => (
        <Pin
          key={id}
          id={id}
          active={id === selectedId}
          level={game.dens[id]}
          sealed={id === "hollow" && game.caveSealed}
          rumor={id === "hollow" && !game.caveKnown}
          onSelect={() => selectDen(id)}
        />
      ))}
      <div
        className="absolute bottom-3 left-3 right-3 rounded-lg border border-border bg-surface/92 p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] tracking-wide text-faint">
          {rumorHollow
            ? "西の断崖 · 未確認"
            : `${den.region} · ${WARLORDS[den.warlord].leader} · ${FACTIONS[den.faction].short}`}
        </p>
        <h2 className="font-display text-lg text-fg">
          {sealedHollow ? "空のダンジョン" : rumorHollow ? "気配" : den.name}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {rumorHollow
            ? "人間はダンジョンに逃げ込んだ。西の断崖の下に、まだ息がある、という噂だけがある。"
            : sealedHollow
              ? "注進のあと、ダンジョンは空だ。人間は客ではない。"
              : den.blurb}
        </p>
        {rumorHollow ? null : (
          <p className="mt-2 text-xs tabular-nums text-faint">
            誘致段階 {lv}/{cap} · 人口 {den.pop} · 襲撃 {Math.round(den.raid * 100)} · 灯の半径{" "}
            {lamp.toFixed(1)}
          </p>
        )}
        <p className="mt-1 text-[11px] text-faint">
          誘致と設備で、荒野が店の色に塗り替わる。同じ種の旗が隣り合うと、ドットが赤く裂ける。
        </p>
        <button
          type="button"
          disabled={rumorHollow || maxed || lockedClaw || sealedHollow || game.gold < cost}
          onClick={() => attract(selectedId)}
          className="mt-3 h-11 w-full rounded-md bg-accent text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          {rumorHollow
            ? "まだ地図にない"
            : sealedHollow
              ? "空のダンジョン"
              : maxed
                ? "誘致上限"
                : lockedClaw
                  ? "竜用駐機が必要"
                  : selectedId === "hollow" && lv === 0
                    ? `灯を渡す ${cost}G`
                    : `${lv === 0 ? "誘致する" : "誘致を深める"} ${cost}G`}
        </button>
      </div>
    </section>
  );
}

function Pin({
  id,
  active,
  level,
  sealed,
  rumor,
  onSelect,
}: {
  id: DenId;
  active: boolean;
  level: number;
  sealed?: boolean;
  rumor?: boolean;
  onSelect: () => void;
}) {
  const den = DENS[id];
  const label = sealed ? "空のダンジョン" : rumor ? "気配" : WARLORDS[den.warlord].name;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      aria-label={label}
      className="absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      style={{ left: `${den.x}%`, top: `${den.y}%` }}
    >
      <span
        className={cn(
          "block size-2 rounded-[1px] border",
          sealed
            ? "border-danger bg-danger/40"
            : rumor
              ? "border-faint bg-transparent"
              : level > 0
                ? "border-accent bg-accent"
                : "border-fg/70 bg-surface",
          active && "size-2.5 animate-[pulse-pin_1.6s_ease-in-out_infinite]",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute top-[calc(100%-6px)] whitespace-nowrap rounded-sm bg-surface/90 px-1.5 py-0.5 text-[10px] text-fg",
          active && "text-accent",
        )}
      >
        {label}
      </span>
    </button>
  );
}
