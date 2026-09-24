import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Tag } from "lucide-react";
import { FACTIONS, FEATS, FEAT_IDS, FINAL_DAY, MAX_PATRON_LEVEL, MAX_TRUE_NAMES, PRODUCTS, PRODUCT_IDS, SPRITE, STAFF, WARLORDS, isPenniless, patronXp, scrapPrice, spentForLevel, timeBand } from "@/game/data";
import { PATRONS, patronSpriteFilter } from "@/game/patrons";
import {
  CATALOG,
  FLOOR_H,
  FLOOR_W,
  defaultCap,
  fixtureAt,
  guestRoute,
  isDoor,
  isGondola,
  isWall,
  nearestOf,
  staffDuty,
  staffHome,
  staffWander,
} from "@/game/layout";
import { useGame } from "@/game/store";
import type { Fixture, FloorVisit, ShelfLog, ShelfLogReason, StaffId } from "@/game/types";
import { cn } from "@/lib/cn";

type Actor = FloorVisit & {
  x: number;
  y: number;
  path: { x: number; y: number }[];
  step: number;
  linger: number;
  shelfAt: number;
  regAt: number;
};

type Inspected = number | "manager" | { shelf: number } | { staff: StaffId } | { scrap: true } | null;

function isShelfInspect(v: Inspected): v is { shelf: number } {
  return typeof v === "object" && v !== null && "shelf" in v;
}

function isStaffInspect(v: Inspected): v is { staff: StaffId } {
  return typeof v === "object" && v !== null && "staff" in v;
}

function isScrapInspect(v: Inspected): v is { scrap: true } {
  return typeof v === "object" && v !== null && "scrap" in v;
}

type Crew = {
  id: StaffId;
  x: number;
  y: number;
  path: { x: number; y: number }[];
  step: number;
  linger: number;
  duty: string;
};

type ShopPhase = "enter" | "pick" | "carry" | "till" | "exit" | "gone";

function shopPhase(a: Actor): ShopPhase {
  const last = Math.max(0, a.path.length - 1);
  if (a.step >= last) return "gone";
  if (a.regAt < 0 || a.regAt > last) {
    if (a.step >= a.shelfAt) return a.picked ? "exit" : "pick";
    return "enter";
  }
  if (a.step > a.regAt) return "exit";
  if (a.step === a.regAt) return "till";
  if (a.step > a.shelfAt) return "carry";
  if (a.step === a.shelfAt) return "pick";
  return "enter";
}

export function StoreFloor() {
  const game = useGame((s) => s.game);
  const designing = useGame((s) => s.ui.designing);
  const debug = useGame((s) => s.ui.debug);
  const setDesigning = useGame((s) => s.setDesigning);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLElement>(null);
  const [actors, setActors] = useState<Actor[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [inspected, setInspected] = useState<Inspected>(null);
  const snapRef = useRef<Actor | null>(null);
  const hourKey = game ? `${game.day}-${game.hour}` : "";
  const staffKey = game?.staff.join(",") ?? "";
  const visits = game?.lastVisits ?? [];

  useEffect(() => {
    if (!game) return;
    setActors((prev) => {
      const have = new Set(prev.map((a) => a.seq));
      const add: Actor[] = [];
      for (const v of game.lastVisits) {
        if (have.has(v.seq) || v.paid) continue;
        const route = guestRoute(game, v.want);
        const start = route.path[0] ?? { x: 6, y: FLOOR_H - 1 };
        add.push({
          ...v,
          x: start.x,
          y: start.y,
          path: route.path,
          step: 0,
          linger: 0,
          shelfAt: route.shelfAt,
          regAt: route.regAt,
        });
      }
      return prev.length >= 14 ? prev : [...prev, ...add];
    });
  }, [hourKey]);

  useEffect(() => {
    if (!game) return;
    setCrew((prev) => {
      const keep = prev.filter((s) => game.staff.includes(s.id));
      const have = new Set(keep.map((s) => s.id));
      const next = keep.map((s) => ({
        ...s,
        path: staffWander(game, s.id, s, game.hour),
        step: 0,
        linger: 0,
        duty: staffDuty(s.id, game.hour),
      }));
      for (const id of game.staff) {
        if (have.has(id)) continue;
        const home = staffHome(game, id);
        next.push({
          id,
          x: home.x,
          y: home.y,
          path: staffWander(game, id, home, game.hour),
          step: 0,
          linger: 0,
          duty: staffDuty(id, game.hour),
        });
      }
      return next;
    });
  }, [hourKey, staffKey]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hold = 0;
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      hold += dt;
      raf = requestAnimationFrame(loop);
      if (hold < 0.05) return;
      const step = hold;
      hold = 0;
      const speed = useGame.getState().game?.speed ?? 1;
      if (speed === 0) return;
      const walk = Math.min(1.35, 0.55 + speed * 0.4);
      setActors((prev) => {
        if (prev.length === 0) return prev;
        const out: Actor[] = [];
        for (const a of prev) {
          const last = a.path.length - 1;
          const live = useGame.getState().game?.lastVisits.find((v) => v.seq === a.seq);
          const body = live ? { ...a, ...live, x: a.x, y: a.y, path: a.path, step: a.step, linger: a.linger, shelfAt: a.shelfAt, regAt: a.regAt } : a;
          if (body.step >= last) {
            const p = body.path[last] ?? body;
            const linger = body.linger + step;
            if (linger > 0.35) {
              useGame.getState().guestLeave(body.seq);
              continue;
            }
            out.push({ ...body, x: p.x, y: p.y, step: last, linger });
            continue;
          }
          if (body.step === body.shelfAt && !body.picked) {
            const tile = body.path[body.shelfAt];
            const liveGame = useGame.getState().game;
            const near = liveGame && tile ? gondolaNear(liveGame.layout, tile.x, tile.y) : undefined;
            useGame.getState().guestPick(body.seq, near?.uid);
          }
          if (body.step === body.shelfAt && body.linger < 0.55) {
            const p = body.path[body.shelfAt] ?? body;
            out.push({ ...body, x: p.x, y: p.y, linger: body.linger + step });
            continue;
          }
          if (body.step === body.regAt) {
            if (body.picked && !body.paid) useGame.getState().guestPay(body.seq);
            if (body.linger < 0.9) {
              const p = body.path[body.regAt] ?? body;
              out.push({ ...body, x: p.x, y: p.y, linger: body.linger + step });
              continue;
            }
          }
          const target = body.path[Math.min(body.step + 1, last)]!;
          const k = 1 - Math.exp(-step * 3.1 * walk);
          const x = body.x + (target.x - body.x) * k;
          const y = body.y + (target.y - body.y) * k;
          let st = body.step;
          let linger = body.linger;
          if (Math.hypot(target.x - x, target.y - y) < 0.08) {
            st += 1;
            linger = 0;
          }
          out.push({ ...body, x, y, step: st, linger });
        }
        return out;
      });
      setCrew((prev) => {
        if (prev.length === 0) return prev;
        const live = useGame.getState().game;
        if (!live) return prev;
        const pace = Math.min(1.1, 0.38 + speed * 0.28);
        const out: Crew[] = [];
        for (const s of prev) {
          const last = Math.max(0, s.path.length - 1);
          if (s.step >= last) {
            const p = s.path[last] ?? s;
            const linger = s.linger + step;
            if (linger > 1.2) {
              const path = staffWander(live, s.id, p, live.hour + 1);
              out.push({ ...s, x: p.x, y: p.y, path, step: 0, linger: 0, duty: staffDuty(s.id, live.hour) });
              continue;
            }
            out.push({ ...s, x: p.x, y: p.y, step: last, linger });
            continue;
          }
          const target = s.path[Math.min(s.step + 1, last)]!;
          const k = 1 - Math.exp(-step * 2.4 * pace);
          const x = s.x + (target.x - s.x) * k;
          const y = s.y + (target.y - s.y) * k;
          let st = s.step;
          let linger = s.linger;
          if (Math.hypot(target.x - x, target.y - y) < 0.08) {
            st += 1;
            linger = 0;
          }
          out.push({ ...s, x, y, step: st, linger });
        }
        return out;
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const icons = new Map<string, HTMLImageElement>();
    const load = (src: string) => {
      if (icons.has(src)) return icons.get(src)!;
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = src;
      icons.set(src, im);
      return im;
    };
    let raf = 0;
    let alive = true;
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
    const draw = () => {
      if (!alive) return;
      const g = useGame.getState().game;
      const ui = useGame.getState().ui;
      const rect = wrap.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0b0e12";
      ctx.fillRect(0, 0, w, h);
      if (!g) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const tileW = w / FLOOR_W;
      const tileH = h / FLOOR_H;
      const band = timeBand(g.hour);
      const lamps = g.layout.filter((f) => f.kind === "lamp");
      const ambient =
        band === "late" ? 0.08 : band === "night" ? 0.16 : band === "dusk" ? 0.38 : band === "dawn" ? 0.48 : 0.62;
      const litAt = (x: number, y: number) => {
        let L = ambient;
        for (const lamp of lamps) {
          const d = Math.hypot(x - lamp.x, y - lamp.y);
          const r = 3.6;
          if (d < r) L += (1 - d / r) ** 1.2 * 0.92;
        }
        return Math.min(1.15, L);
      };
      for (let y = 0; y < FLOOR_H; y++) {
        for (let x = 0; x < FLOOR_W; x++) {
          const px = x * tileW;
          const py = y * tileH;
          const L = litAt(x, y);
          if (isWall(x, y) && !isDoor(x, y)) {
            ctx.fillStyle = mixRgb([12, 14, 18], [42, 48, 52], L);
            ctx.fillRect(px, py, tileW, tileH);
            ctx.strokeStyle = mixRgb([22, 26, 32], [70, 78, 82], L * 0.7);
            ctx.strokeRect(px + 0.5, py + 0.5, tileW - 1, tileH - 1);
            continue;
          }
          if (isDoor(x, y)) {
            ctx.fillStyle = mixRgb([70, 54, 28], [210, 176, 96], L);
            ctx.fillRect(px, py, tileW, tileH);
            ctx.fillStyle = "#0b0e12";
            ctx.fillRect(px + tileW * 0.2, py + tileH * 0.55, tileW * 0.6, tileH * 0.18);
            continue;
          }
          const odd = y % 2 === x % 2;
          ctx.fillStyle = odd
            ? mixRgb([16, 20, 26], [68, 82, 78], L)
            : mixRgb([14, 17, 22], [58, 72, 70], L);
          ctx.fillRect(px, py, tileW, tileH);
          if (L > 0.35) {
            ctx.fillStyle = `rgba(236,230,216,${(L - 0.35) * 0.16})`;
            ctx.fillRect(px, py, tileW, tileH);
          }
          if (ui.designing) {
            ctx.strokeStyle = "rgba(126,200,192,0.18)";
            ctx.strokeRect(px + 0.5, py + 0.5, tileW - 1, tileH - 1);
          }
          if (ui.debug) {
            ctx.strokeStyle = "rgba(126,200,192,0.28)";
            ctx.strokeRect(px + 0.5, py + 0.5, tileW - 1, tileH - 1);
            ctx.fillStyle = "rgba(232, 236, 228, 0.55)";
            ctx.font = `${Math.max(8, Math.min(11, tileW * 0.28))}px ui-monospace, monospace`;
            ctx.fillText(`${x},${y}`, px + 2, py + 10);
          }
        }
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const lamp of lamps) {
        if (ui.holding === lamp.uid) continue;
        const cx = (lamp.x + 0.5) * tileW;
        const cy = (lamp.y + 0.5) * tileH;
        const rad = Math.max(tileW, tileH) * 3.2;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grd.addColorStop(0, "rgba(244,240,220,0.55)");
        grd.addColorStop(0.22, "rgba(210,224,200,0.28)");
        grd.addColorStop(0.55, "rgba(160,190,170,0.08)");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      for (const f of g.layout) {
        const L = litAt(f.x, f.y);
        ctx.globalAlpha = f.kind === "lamp" ? 1 : 0.45 + L * 0.55;
        if (ui.holding === f.uid) ctx.globalAlpha *= 0.35;
        drawFix(ctx, f, tileW, tileH, load);
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

  const overlay = useMemo(() => {
    if (!game) return "bg-transparent";
    const lamps = game.layout.filter((f) => f.kind === "lamp").length;
    const cover = Math.min(1, lamps * 0.42);
    const b = timeBand(game.hour);
    const night = b === "late" ? 0.42 : b === "night" ? 0.28 : b === "dusk" ? 0.12 : 0;
    const a = Math.max(0, night * (1 - cover));
    if (a <= 0.02) return "bg-transparent";
    if (a > 0.3) return "bg-bg/40";
    if (a > 0.18) return "bg-bg/25";
    if (b === "dusk") return "bg-warn/10";
    return "bg-bg/10";
  }, [game]);

  const onFloorClick = (e: MouseEvent<HTMLElement>) => {
    if (!game) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / FLOOR_W));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / FLOOR_H));
    const st = useGame.getState();
    const hit = fixtureAt(game.layout, x, y);
    if (!st.ui.designing) {
      if (hit && isGondola(hit)) {
        setInspected({ shelf: hit.uid });
        return;
      }
      setInspected(null);
      return;
    }
    if (st.ui.holding != null) {
      st.placeAt(x, y);
      return;
    }
    if (hit) {
      st.pickupFixture(hit.uid);
      return;
    }
    st.placeAt(x, y);
  };

  if (!game) return null;
  const reg = nearestOf(game.layout, (f) => f.kind === "register", { x: 10, y: 3 });

  return (
    <section ref={wrapRef} className="absolute inset-0 overflow-hidden bg-bg" onClick={onFloorClick}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div className={cn("pointer-events-none absolute inset-0 transition-colors duration-500", overlay)} />
      {!designing ? (
        <button
          type="button"
          className={cn(
            "absolute z-[9] flex flex-col items-center justify-center rounded-sm border border-border bg-surface/80",
            isScrapInspect(inspected) && "z-30 ring-2 ring-accent",
          )}
          style={tileHitStyle(11, 5)}
          aria-label="見切り箱"
          onClick={(e) => {
            e.stopPropagation();
            setInspected({ scrap: true });
          }}
        >
          <span className="text-xs text-accent">見切り</span>
        </button>
      ) : null}
      {!designing
        ? game.layout.filter(isGondola).map((f) => (
            <button
              key={f.uid}
              type="button"
              className={cn(
                "absolute z-[9]",
                isShelfInspect(inspected) && inspected.shelf === f.uid && "z-30 ring-2 ring-accent ring-inset",
              )}
              style={tileHitStyle(f.x, f.y)}
              aria-label={`${f.product ? PRODUCTS[f.product].name : "棚"}の履歴`}
              onClick={(e) => {
                e.stopPropagation();
                setInspected({ shelf: f.uid });
              }}
            />
          ))
        : null}
      {crew.map((s) => {
        const kind = STAFF[s.id];
        return (
          <button
            key={s.id}
            type="button"
            className={cn(
              "absolute z-[12] flex size-11 items-center justify-center",
              isStaffInspect(inspected) && inspected.staff === s.id && "z-30 ring-2 ring-accent",
            )}
            style={spriteStyle(s.x, s.y)}
            aria-label={kind.name}
            onClick={(e) => {
              e.stopPropagation();
              setInspected({ staff: s.id });
            }}
          >
            <img
              src={FACTIONS[kind.faction].sprite}
              alt=""
              className="guest-bob max-h-11 w-9 sm:w-10"
              style={{ filter: staffSpriteFilter(s.id) }}
              crossOrigin="anonymous"
            />
            {debug ? (
              <span className="pointer-events-none absolute -bottom-3 whitespace-nowrap text-[10px] tabular-nums text-accent">
                {s.id}
              </span>
            ) : null}
          </button>
        );
      })}
      {reg ? (
        <button
          type="button"
          className={cn(
            "absolute z-10 flex size-11 items-center justify-center",
            inspected === "manager" && "z-30 ring-2 ring-accent",
          )}
          style={spriteStyle(reg.x, reg.y)}
          aria-label="人族のゆうしゃ"
          onClick={(e) => {
            e.stopPropagation();
            setInspected("manager");
          }}
        >
          <img src={SPRITE.manager} alt="" className="guest-bob max-h-11 w-auto" crossOrigin="anonymous" />
        </button>
      ) : null}
      {actors.map((a) => (
        <button
          key={a.seq}
          type="button"
          className={cn(
            "absolute z-20 flex size-11 items-center justify-center",
            a.named && "z-[21]",
            inspected !== "manager" &&
              !isShelfInspect(inspected) &&
              !isStaffInspect(inspected) &&
              inspected === a.seq &&
              "z-30 ring-2 ring-accent",
          )}
          style={spriteStyle(a.x, a.y)}
          aria-label={guestLabel(a)}
          onClick={(e) => {
            e.stopPropagation();
            snapRef.current = a;
            setInspected(a.seq);
          }}
        >
          <img
            src={a.named ? WARLORDS[a.named].sprite : FACTIONS[a.faction].sprite}
            alt=""
            className={cn(
              "guest-bob w-auto",
              a.named ? "max-h-16 w-12" : "max-h-11 w-8 sm:w-10",
              (shopPhase(a) === "exit" || shopPhase(a) === "gone") &&
                a.mood === "empty" &&
                "opacity-70 grayscale",
            )}
            style={
              a.named || !a.patron || !PATRONS[a.patron]
                ? undefined
                : { filter: patronSpriteFilter(PATRONS[a.patron].hue) }
            }
            crossOrigin="anonymous"
          />
            {debug ? (
              <span className="pointer-events-none absolute -bottom-3 whitespace-nowrap text-[10px] tabular-nums text-accent">
                #{a.seq} {shopPhase(a)}
                {a.scrap ? " 見" : ""}
              </span>
            ) : null}
        </button>
      ))}
      {inspected === "manager" ? (
        <GuestCard who="manager" onClose={() => setInspected(null)} />
      ) : isShelfInspect(inspected) ? (
        <ShelfCard uid={inspected.shelf} onClose={() => setInspected(null)} />
      ) : isScrapInspect(inspected) ? (
        <ScrapCard onClose={() => setInspected(null)} />
      ) : isStaffInspect(inspected) ? (
        <StaffCard id={inspected.staff} duty={crew.find((s) => s.id === inspected.staff)?.duty} onClose={() => setInspected(null)} />
      ) : inspected != null ? (
        <GuestCard
          who={actors.find((a) => a.seq === inspected) ?? snapRef.current}
          onClose={() => setInspected(null)}
        />
      ) : null}
      <div className="pointer-events-none absolute left-3 top-3 font-display text-sm text-fg/80">
        半世界24 · {designing ? "改装" : "営業"}
      </div>
      {debug ? (
        <pre className="pointer-events-none absolute left-3 top-10 z-20 max-w-[min(100%-1.5rem,18rem)] rounded-sm border border-border bg-surface/80 p-2 text-[10px] leading-snug tabular-nums text-accent">
          {`${game.day}日 ${String(game.hour).padStart(2, "0")}時 rng ${game.rng}
客 ${actors.length}/${game.lastVisits.length} 店員 ${crew.length}
売上 ${game.goldToday}G 欠 ${game.missedToday}
${actors
  .map((a) => `#${a.seq} ${shopPhase(a)} ${a.x.toFixed(1)},${a.y.toFixed(1)}`)
  .join("\n")}`}
        </pre>
      ) : null}
      <div className="absolute right-3 top-3 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setInspected(null);
            setDesigning(!designing);
          }}
          className={cn(
            "h-11 rounded-md px-3 text-sm",
            designing ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg",
          )}
        >
          {designing ? "営業に戻る" : "改装する"}
        </button>
      </div>
      {designing ? <DesignDock /> : (
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm">
          <Objectives />
        </div>
      )}
    </section>
  );
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const ch = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * k);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

function spriteStyle(gx: number, gy: number): { left: string; top: string; transform: string } {
  return {
    left: `${((gx + 0.5) / FLOOR_W) * 100}%`,
    top: `${((gy + 0.15) / FLOOR_H) * 100}%`,
    transform: "translate(-50%, -70%)",
  };
}

function tileHitStyle(gx: number, gy: number) {
  return {
    left: `${(gx / FLOOR_W) * 100}%`,
    top: `${(gy / FLOOR_H) * 100}%`,
    width: `${100 / FLOOR_W}%`,
    height: `${100 / FLOOR_H}%`,
  };
}

function gondolaNear(layout: Fixture[], x: number, y: number): Fixture | undefined {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const hit = fixtureAt(layout, cx, cy);
  if (hit && isGondola(hit)) return hit;
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const f = fixtureAt(layout, cx + dx, cy + dy);
    if (f && isGondola(f)) return f;
  }
}

const SHELF_REASON: Record<ShelfLogReason, (n: number, who?: string) => string> = {
  sale: (n, who) => `${who ?? "客"}が${n}個取った`,
  raid: (n) => `襲撃で${n}個失った`,
  waste: (n) => `賞味で${n}個捨てた`,
  event: (n) => `出来事で${n}個出た`,
  restock: (n, who) => (who ? `${who}が${n}個載せた` : `倉庫から${n}個載せた`),
  order: (n) => `便が${n}個載せた`,
  clear: (n) => `棚を空にした（${n}個）`,
};

function staffSpriteFilter(id: StaffId): string {
  const hue: Record<StaffId, number> = {
    clerk: 8,
    stocker: 48,
    courier: 210,
    guard: 0,
    night: 280,
    host: 32,
    scribe: 150,
    hermit: 70,
  };
  return `hue-rotate(${hue[id]}deg) saturate(1.2) brightness(1.05)`;
}

function StaffCard({ id, duty, onClose }: { id: StaffId; duty?: string; onClose: () => void }) {
  const game = useGame((s) => s.game);
  const designing = useGame((s) => s.ui.designing);
  const kind = STAFF[id];
  const fac = FACTIONS[kind.faction];
  const box = cn(
    "absolute left-3 z-30 w-[min(100%-1.5rem,22rem)] rounded-lg border border-border bg-surface/95 p-3 shadow-lg",
    designing ? "bottom-28" : "bottom-3",
  );
  return (
    <aside className={box} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <img
          src={fac.sprite}
          alt=""
          className="h-16 w-auto"
          style={{ filter: staffSpriteFilter(id) }}
          crossOrigin="anonymous"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-fg">{kind.name}</p>
          <p className="text-xs text-accent">{fac.short} · 店員</p>
          <p className="mt-1 text-sm text-muted">{kind.blurb}</p>
          <ul className="mt-2 space-y-0.5 text-xs tabular-nums text-fg">
            <li>{duty ?? staffDuty(id, game?.hour ?? 7)}</li>
            <li>日給 {kind.wage}G</li>
          </ul>
        </div>
        <button type="button" className="h-11 shrink-0 px-2 text-sm text-faint" onClick={onClose}>
          閉じる
        </button>
      </div>
    </aside>
  );
}

function logLine(log: ShelfLog): string {
  const n = Math.abs(log.delta);
  return SHELF_REASON[log.reason](n, log.who);
}

function ScrapCard({ onClose }: { onClose: () => void }) {
  const game = useGame((s) => s.game);
  const designing = useGame((s) => s.ui.designing);
  if (!game) return null;
  const lines = PRODUCT_IDS.map((id) => ({ id, n: game.scrap?.[id] ?? 0, p: PRODUCTS[id], price: scrapPrice(id) })).filter(
    (x) => x.n > 0,
  );
  const box = cn(
    "absolute left-3 z-30 w-[min(100%-1.5rem,22rem)] rounded-lg border border-border bg-surface/95 p-3 shadow-lg",
    designing ? "bottom-28" : "bottom-3",
  );
  return (
    <aside className={box} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-fg">見切り箱</p>
          <p className="text-xs text-muted">賞味が落ちた兵糧。定価の四割。財布の薄い常連が手を伸ばす。</p>
        </div>
        <button type="button" className="h-11 shrink-0 px-2 text-sm text-faint" onClick={onClose}>
          閉じる
        </button>
      </div>
      <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
        {lines.length === 0 ? (
          <li className="text-xs text-muted">空だ。夜が明けて賞味が落ちると、ここに積まれる。</li>
        ) : (
          lines.map((x) => (
            <li key={x.id} className="flex items-center gap-2 rounded-sm bg-elevated px-2 py-1.5">
              <img src={x.p.icon} alt="" className="size-8 object-contain" crossOrigin="anonymous" />
              <span className="flex-1 text-xs text-fg">{x.p.name}</span>
              <span className="text-xs tabular-nums text-muted">
                {x.n}個 · {x.price}G
              </span>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

function ShelfCard({ uid, onClose }: { uid: number; onClose: () => void }) {
  const game = useGame((s) => s.game);
  const designing = useGame((s) => s.ui.designing);
  if (!game) return null;
  const fixture = game.layout.find((f) => f.uid === uid);
  if (!fixture || !isGondola(fixture) || !fixture.product) return null;
  const product = PRODUCTS[fixture.product];
  const cap = fixture.capacity ?? defaultCap(fixture.kind);
  const stock = fixture.stock ?? 0;
  const logs = (game.shelfLogs ?? []).filter((l) => l.uid === uid);
  const todayOut = logs.filter((l) => l.day === game.day && l.delta < 0).reduce((s, l) => s + -l.delta, 0);
  const todayIn = logs.filter((l) => l.day === game.day && l.delta > 0).reduce((s, l) => s + l.delta, 0);
  const box = cn(
    "absolute left-3 z-30 w-[min(100%-1.5rem,22rem)] rounded-lg border border-border bg-surface/95 p-3 shadow-lg",
    designing ? "bottom-28" : "bottom-3",
  );
  return (
    <aside className={box} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <img src={product.icon} alt="" className="size-12 object-contain" crossOrigin="anonymous" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-fg">{product.name}の棚</p>
          <p className="text-xs tabular-nums text-muted">
            在庫 {stock}/{cap}
            {fixture.reorderBelow ? ` · ${fixture.reorderBelow}個以下で便` : ""}
          </p>
          <p className="mt-1 text-xs tabular-nums text-faint">
            今日 減 {todayOut} · 入 {todayIn}
          </p>
        </div>
        <button type="button" className="h-11 shrink-0 px-2 text-sm text-faint" onClick={onClose}>
          閉じる
        </button>
      </div>
      <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
        {logs.length === 0 ? (
          <li className="text-xs text-muted">まだこの棚から減っていない。客が手を伸ばすと、ここに残る。</li>
        ) : (
          logs.map((l) => (
            <li key={l.id} className="rounded-sm bg-elevated px-2 py-1.5">
              <p className={cn("text-xs", l.delta < 0 ? "text-danger" : "text-ok")}>{logLine(l)}</p>
              <p className="text-xs tabular-nums text-faint">
                {l.day}日目 {String(l.hour).padStart(2, "0")}時 · 残り {l.after}
              </p>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

function drawFix(
  ctx: CanvasRenderingContext2D,
  f: Fixture,
  tileW: number,
  tileH: number,
  load: (src: string) => HTMLImageElement,
) {
  const px = f.x * tileW;
  const py = f.y * tileH;
  const padX = tileW * 0.12;
  const padY = tileH * 0.12;
  const fill: Record<string, string> = {
    shelf: "#3a3228",
    register: "#7ec8c0",
    hotcase: "#c45c5c",
    atm: "#c4a15c",
    lamp: "#ece6d8",
    golem: "#6d7680",
    hatch: "#b57a5c",
    perch: "#c4a15c",
    crate: "#5a4a3a",
  };
  ctx.fillStyle = fill[f.kind] ?? "#3a3228";
  if (f.kind === "lamp") {
    const cx = px + tileW / 2;
    const cy = py + tileH * 0.28;
    const tw = tileW * 0.72;
    const th = Math.max(4, tileH * 0.12);
    ctx.fillStyle = "rgba(244,240,220,0.95)";
    ctx.fillRect(cx - tw / 2, cy - th / 2, tw, th);
    ctx.strokeStyle = "rgba(236,230,216,0.9)";
    ctx.strokeRect(cx - tw / 2, cy - th / 2, tw, th);
    ctx.fillStyle = "rgba(180, 200, 170, 0.55)";
    ctx.fillRect(cx - tw / 2, cy + th / 2, tw, th * 0.45);
    return;
  }
  ctx.fillRect(px + padX, py + padY, tileW - padX * 2, tileH - padY * 2);
  ctx.strokeStyle = "#0b0e12";
  ctx.strokeRect(px + padX, py + padY, tileW - padX * 2, tileH - padY * 2);
  if (f.product) {
    const im = load(`/game/products/${f.product}.png`);
    if (im.complete && im.naturalWidth > 0) {
      const s = Math.min(tileW, tileH) * 0.5;
      ctx.drawImage(im, px + (tileW - s) / 2, py + (tileH - s) / 2, s, s);
    }
    const cap = Math.max(1, f.capacity ?? 20);
    const ratio = Math.min(1, (f.stock ?? 0) / cap);
    const bw = tileW - padX * 2;
    const bh = Math.max(3, tileH * 0.08);
    ctx.fillStyle = "#0b0e12";
    ctx.fillRect(px + padX, py + tileH - padY - bh, bw, bh);
    ctx.fillStyle = ratio > 0.25 ? "#7ec8c0" : "#c45c5c";
    ctx.fillRect(px + padX, py + tileH - padY - bh, bw * ratio, bh);
  }
  const face = f.rot;
  ctx.fillStyle = "#ece6d8";
  const mx = tileW * 0.08;
  const my = tileH * 0.08;
  if (face === 0) ctx.fillRect(px + padX, py + tileH - padY - my, tileW - padX * 2, my);
  if (face === 1) ctx.fillRect(px + tileW - padX - mx, py + padY, mx, tileH - padY * 2);
  if (face === 2) ctx.fillRect(px + padX, py + padY, tileW - padX * 2, my);
  if (face === 3) ctx.fillRect(px + padX, py + padY, mx, tileH - padY * 2);
}

function guestLabel(a: Actor): string {
  if (a.nickname) return a.nickname;
  if (a.named) return WARLORDS[a.named].leader;
  if (a.patron && PATRONS[a.patron]) return PATRONS[a.patron].name;
  return FACTIONS[a.faction].short;
}

function lastVisitText(who: Actor, day: number, counted: boolean): string {
  const n = who.visitCount ?? 1;
  const done = counted ? n : n - 1;
  if (done <= 0 || who.prevDay == null) return "初来店";
  const delta = day - who.prevDay;
  const hh = String(who.prevHour ?? 0).padStart(2, "0");
  if (delta <= 0) return `今日 ${hh}時にも来た`;
  if (delta === 1) return `昨日 ${hh}時`;
  return `${delta}日前の${hh}時`;
}

function statusLine(who: Actor, phase: ShopPhase): string {
  const want = PRODUCTS[who.want].name;
  const got = `${who.scrap ? "見切りの" : ""}${PRODUCTS[who.got ?? who.want].name}`;
  const n = who.bought ?? 0;
  if (phase === "enter") return `${want}を目当てに、店へ入った。まだ棚にも着いていない。`;
  if (phase === "pick") return `棚の前。${want}を手に取っている。会計はまだだ。`;
  if (phase === "carry") {
    if (who.mood === "empty" || n <= 0) return "かごは空だ。レジの前を通って出口へ向かう。";
    return `${got}をかごに入れ、レジへ歩いている。まだ会計していない。`;
  }
  if (phase === "till") {
    if (!who.paid) return "レジに着いた。これから会計する。";
    if (who.mood === "empty" || n <= 0) return "レジに立ったが、かごは空だ。";
    return "レジで会計している。";
  }
  if (who.broke) return phase === "gone" ? "金が足りず、空で出ていった。" : "金が足りず、出口へ向かっている。";
  if (who.mood === "empty" || n <= 0) {
    return phase === "gone" ? "空で出ていった。" : "空の手で出口へ向かっている。";
  }
  if (phase === "exit") {
    if (who.y >= FLOOR_H - 0.35) {
      return who.binge && n >= 2 ? `${got}を持って店を出ていく。` : `${got}を持って店を出ていく。`;
    }
    return who.binge && n >= 2
      ? `${got}を爆買いし、出口から外へ歩いている。`
      : `${got}の会計を済ませ、出口から外へ歩いている。`;
  }
  if (who.binge && n >= 2) return `${got}×${n}を爆買いして、店を出た。`;
  return `${got}×${n}を買って、店を出た。`;
}

function GuestCard({ who, onClose }: { who: Actor | "manager" | null; onClose: () => void }) {
  const designing = useGame((s) => s.ui.designing);
  const day = useGame((s) => s.game?.day ?? 1);
  const gold = useGame((s) => s.game?.gold ?? 0);
  const patrons = useGame((s) => s.game?.patrons ?? {});
  const nameGuest = useGame((s) => s.nameGuest);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const box = cn(
    "absolute left-3 z-30 w-[min(100%-1.5rem,22rem)] rounded-lg border border-border bg-surface/95 p-3 shadow-lg",
    designing ? "bottom-28" : "bottom-3",
  );
  if (!who) return null;
  if (who === "manager") {
    return (
      <aside className={box} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <img src={SPRITE.manager} alt="" className="h-16 w-auto" crossOrigin="anonymous" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-fg">人族のゆうしゃ</p>
            <p className="text-xs text-accent">半世界24 · 店主</p>
            <p className="mt-1 text-sm text-muted">りゅうおうの部下ではない。剣は棚の奥。レジに立っている。</p>
          </div>
          <button type="button" className="h-11 shrink-0 px-2 text-sm text-faint" onClick={onClose}>
            閉じる
          </button>
        </div>
      </aside>
    );
  }
  const fac = FACTIONS[who.faction];
  const named = who.named ? WARLORDS[who.named] : null;
  const want = PRODUCTS[who.want];
  const patron = who.patron ? PATRONS[who.patron] : undefined;
  const mem = who.patron ? patrons[who.patron] : undefined;
  const nick = who.nickname ?? mem?.nickname;
  const title = named ? named.leader : nick ? nick : patron ? patron.name : fac.name;
  const lv = who.level ?? mem?.level ?? 1;
  const sub = named
    ? `${named.name} · ${named.title}`
    : patron
      ? nick
        ? `${patron.name} · ${fac.short}${isPenniless(patron.purse) && lv >= 3 ? " · 成り上がり" : ""}`
        : `${fac.short} · ${isPenniless(patron.purse) && lv >= 3 ? "成り上がり" : patron.role}`
      : fac.short;
  const blurb = named ? named.blurb : patron ? patron.blurb : fac.blurb;
  const phase = shopPhase(who);
  const paid = who.paid === true;
  const visitsShow = paid ? (who.visitCount ?? 1) : Math.max(0, (who.visitCount ?? 1) - 1);
  const mul = mem?.purseMul ?? who.purseMul;
  const used = Object.values(patrons).filter((m) => m.nickname).length;
  const cost = mem?.nickname ? 40 : 80 * (used + 1) * (used + 1);
  const spentXp = paid ? (who.spentTotal ?? mem?.spent ?? 0) : (mem?.spent ?? 0);
  const visitsXp = paid ? (who.visitCount ?? mem?.visits ?? 0) : (mem?.visits ?? 0);
  const xpNow = patronXp(spentXp, visitsXp);
  const xpLo = spentForLevel(lv);
  const xpHi = lv >= MAX_PATRON_LEVEL ? Math.max(xpNow, xpLo) : spentForLevel(lv + 1);
  const xpPct = xpHi <= xpLo ? 100 : Math.max(0, Math.min(100, ((xpNow - xpLo) / (xpHi - xpLo)) * 100));
  const submitName = (e: FormEvent) => {
    e.preventDefault();
    if (!who.patron) return;
    nameGuest(who.patron, draft);
    setNaming(false);
    setDraft("");
  };
  return (
    <aside className={box} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <img
          src={named ? named.sprite : fac.sprite}
          alt=""
          className={named ? "h-28 w-auto" : "h-16 w-auto"}
          style={named || !patron ? undefined : { filter: patronSpriteFilter(patron.hue) }}
          crossOrigin="anonymous"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="font-display text-base text-fg">{title}</p>
            {who.patron && !named ? (
              <button
                type="button"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-accent hover:bg-accent/15"
                aria-label="真名を付ける"
                onClick={() => {
                  setDraft(nick ?? "");
                  setNaming((v) => !v);
                }}
              >
                <Tag className="size-4" />
              </button>
            ) : null}
          </div>
          <p className="text-xs text-accent">{sub}</p>
          <p className="mt-1 text-sm text-muted">{blurb}</p>
          {naming && who.patron ? (
            <form className="mt-2 flex flex-wrap items-center gap-1" onSubmit={submitName}>
              <input
                autoFocus
                value={draft}
                maxLength={8}
                placeholder="真名（八文字まで）"
                onChange={(e) => setDraft(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-sm border border-border bg-bg px-2 text-sm text-fg"
              />
              <button
                type="submit"
                disabled={gold < cost || !draft.trim()}
                className="h-9 rounded-sm bg-accent px-2 text-xs text-bg disabled:opacity-40"
              >
                刻む {cost}G
              </button>
              <p className="w-full text-[11px] text-faint">
                真名 {used}/{MAX_TRUE_NAMES} · 次から所持金が3〜10倍 · 同じ名は店内に一体
              </p>
            </form>
          ) : null}
          <ul className="mt-2 space-y-0.5 text-xs tabular-nums text-fg">
            <li>
              {lastVisitText(who, day, paid)}
              {visitsShow > 0 ? ` · 来店 ${visitsShow}回` : ""}
            </li>
            <li>
              <span className={who.leveledTo ? "text-ok" : undefined}>
                {lv}段{who.leveledTo ? "になった" : ""}
              </span>
              {spentXp > 0 ? ` · ${paid ? "累計" : "経験"} ${Math.round(spentXp)}G` : ""}
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-elevated">
                <span className="block h-full bg-accent" style={{ width: `${xpPct}%` }} />
              </span>
            </li>
            <li>
              {paid ? `財布の残り ${who.purseLeft ?? "—"}G` : `持ち金 ${who.purseLeft ?? "—"}G`}
              {who.purseMul && who.purseMul > 1
                ? ` · 真名 ${who.purseMul}倍`
                : nick && mul && mul > 1
                  ? ` · 次から ${mul}倍`
                  : ""}
              {!paid && patron && patron.binge >= 0.45 ? " · 爆買い体質" : ""}
            </li>
            <li>{statusLine(who, phase)}</li>
          </ul>
        </div>
        <button type="button" className="h-11 shrink-0 px-2 text-sm text-faint" onClick={onClose}>
          閉じる
        </button>
      </div>
    </aside>
  );
}

function DesignDock() {
  const tool = useGame((s) => s.ui.designTool);
  const holding = useGame((s) => s.ui.holding);
  const setTool = useGame((s) => s.setDesignTool);
  const rotate = useGame((s) => s.rotateHeld);
  const gold = useGame((s) => s.game?.gold ?? 0);
  return (
    <div
      className="absolute inset-x-2 bottom-2 z-20 rounded-lg border border-border bg-surface/95 p-2 sm:inset-x-auto sm:left-3 sm:right-auto sm:max-w-md"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11px] tracking-wide text-faint">什器カタログ · 空きマスに置く · 置いた物を掴んで移す</p>
        <button
          type="button"
          disabled={holding == null}
          onClick={rotate}
          className="ml-auto h-9 rounded-sm border border-border px-2 text-xs text-fg disabled:opacity-40"
        >
          回転
        </button>
        <button
          type="button"
          onClick={() => setTool(tool === "sell" ? null : "sell")}
          className={cn(
            "h-9 rounded-sm px-2 text-xs",
            tool === "sell" ? "bg-danger text-fg" : "border border-border text-muted",
          )}
        >
          売る
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATALOG.map((c) => {
          const on = tool === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setTool(on ? null : c.id)}
              className={cn(
                "flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-md border px-1 text-center",
                on ? "border-accent bg-elevated text-accent" : "border-border bg-elevated text-fg",
                gold < c.cost && !on && "opacity-50",
              )}
            >
              <span className="text-[11px] leading-tight">{c.name}</span>
              <span className="text-[10px] tabular-nums text-faint">{c.cost}G</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Objectives() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  if (game.era === "endless") {
    const items = FEAT_IDS.map((id) => ({ done: game.feats[id], label: FEATS[id].name }));
    return (
      <div className="rounded-lg border border-border bg-surface/85 p-3 backdrop-blur-sm">
        <p className="text-[11px] tracking-wide text-faint">やりこみ · 覇業</p>
        <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {items.map((it) => (
            <li
              key={it.label}
              className={cn("text-sm", it.done ? "text-faint line-through" : "text-fg")}
            >
              {it.done ? "済" : "未"} · {it.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (game.day > 8 && game.day <= FINAL_DAY && !game.clearModal) {
    return (
      <div className="rounded-lg border border-border bg-surface/85 p-3 backdrop-blur-sm">
        <p className="text-[11px] tracking-wide text-faint">シナリオ</p>
        <p className="mt-1 text-sm text-fg">
          {FINAL_DAY}日まで灯を守れ。クリア後が、内乱の本番だ。
        </p>
        <p className="mt-1 text-xs tabular-nums text-faint">残り {Math.max(0, FINAL_DAY - game.day + 1)} 日</p>
      </div>
    );
  }
  const items = [
    { done: game.tutorial.ordered, label: "棚を発注する" },
    { done: game.tutorial.designed, label: "店内を改装する" },
    { done: game.tutorial.openedMap, label: "地図を開く" },
    { done: game.tutorial.attracted, label: "巣穴を誘致する" },
    { done: game.caveKnown, label: "西の足音に耳を貸す" },
    { done: game.gold >= 900, label: "所持金 900G" },
  ];
  if (items.every((it) => it.done)) return null;
  return (
    <div className="rounded-lg border border-border bg-surface/85 p-3 backdrop-blur-sm">
      <p className="text-[11px] tracking-wide text-faint">開店の務め</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((it) => (
          <li
            key={it.label}
            className={cn("text-sm", it.done ? "text-faint line-through" : "text-fg")}
          >
            {it.done ? "済" : "未"} · {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
