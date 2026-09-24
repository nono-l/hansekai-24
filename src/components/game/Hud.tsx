import { useRef, useState, type ReactNode } from "react";
import { FastForward, Pause, Play, ScrollText, Settings } from "lucide-react";
import { BAND_LABEL, FINAL_DAY, timeBand } from "@/game/data";
import { useGame } from "@/game/store";
import { Button } from "@/components/ui/button";
import type { FastSpeed } from "@/game/types";
import { cn } from "@/lib/cn";

const FAST: FastSpeed[] = [3, 5, 10, 20];

function isFast(n: number): n is FastSpeed {
  return n === 3 || n === 5 || n === 10 || n === 20;
}

export function Hud() {
  const game = useGame((s) => s.game);
  const setSpeed = useGame((s) => s.setSpeed);
  const toTitle = useGame((s) => s.toTitle);
  const copyChronicle = useGame((s) => s.copyChronicle);
  const setSettings = useGame((s) => s.setSettings);
  const debug = useGame((s) => s.ui.debug);
  const [rate, setRate] = useState<FastSpeed>(3);
  const [open, setOpen] = useState(false);
  const held = useRef(false);
  const timer = useRef(0);
  if (!game) return null;
  const band = timeBand(game.hour);
  const hourLabel = `${String(game.hour).padStart(2, "0")}:${String(game.minute ?? 0).padStart(2, "0")}`;
  const fast = isFast(game.speed);
  const shown = fast ? game.speed : rate;

  const arm = () => {
    held.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      held.current = true;
      setOpen(true);
    }, 420);
  };
  const disarm = () => window.clearTimeout(timer.current);
  const tapFast = () => {
    if (held.current) {
      held.current = false;
      return;
    }
    setOpen(false);
    setSpeed(rate);
  };
  const pick = (n: FastSpeed) => {
    setRate(n);
    setOpen(false);
    setSpeed(n);
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/90 px-3 py-2 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="font-display text-base leading-tight text-fg">
          半世界24
          {debug ? <span className="ml-2 text-xs tracking-wide text-accent">DEBUG</span> : null}
        </p>
        <p className="text-xs text-muted tabular-nums">
          {game.era === "scenario" && game.day <= FINAL_DAY ? "シナリオ" : "やりこみ"} {game.day}
          {game.era === "scenario" && game.day <= FINAL_DAY ? `/${FINAL_DAY}` : ""}日目 {hourLabel} {BAND_LABEL[band]}
        </p>
      </div>
      <Stat label="所持金" value={`${game.gold}G`} warn={game.gold < 80} always />
      <Stat label="店HP" value={`${Math.round(game.storeHp)}`} warn={game.storeHp < 40} />
      <Stat label="りゅうおう" value={`${Math.round(game.emperor)}`} warn={game.emperor < 30} />
      <Stat label="戦争熱" value={`${Math.round(game.warHeat)}`} warn={game.warHeat > 60} />
      <div className="flex items-center gap-1">
        <IconBtn active={game.speed === 0} label="停止" onClick={() => setSpeed(0)}>
          <Pause className="size-4" />
        </IconBtn>
        <IconBtn active={game.speed === 1} label="再生" onClick={() => setSpeed(1)}>
          <Play className="size-4" />
        </IconBtn>
        <div className={cn("relative", open && "z-40")}>
          <button
            type="button"
            aria-label={`早送り ${shown}倍。長押しで倍率`}
            aria-expanded={open}
            onPointerDown={arm}
            onPointerUp={disarm}
            onPointerLeave={disarm}
            onPointerCancel={disarm}
            onContextMenu={(e) => e.preventDefault()}
            onClick={tapFast}
            className={cn(
              "relative grid size-11 place-items-center rounded-sm border transition-colors duration-150",
              fast ? "border-accent bg-accent text-accent-fg" : "border-border bg-elevated text-muted hover:text-fg",
            )}
          >
            <FastForward className="size-4" />
            <span className="absolute bottom-0.5 text-[10px] tabular-nums leading-none">×{shown}</span>
          </button>
          {open ? (
            <div className="absolute top-full right-0 z-40 mt-2 w-36 rounded-md border border-border bg-surface p-2 shadow-xl">
              <p className="px-1 pb-1 text-[10px] tracking-wide text-faint">早送り</p>
              <div className="grid grid-cols-2 gap-1">
                {FAST.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => pick(n)}
                    className={cn(
                      "min-h-11 rounded-sm border text-sm tabular-nums",
                      shown === n && fast
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-elevated text-fg",
                    )}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <IconBtn active={false} label="日誌をコピー" onClick={copyChronicle}>
          <ScrollText className="size-4" />
        </IconBtn>
        <IconBtn active={false} label="設定" onClick={() => setSettings(true)}>
          <Settings className="size-4" />
        </IconBtn>
        <Button variant="ghost" size="sm" onClick={toTitle} className="hidden sm:inline-flex">
          看板
        </Button>
      </div>
      {open ? (
        <button
          type="button"
          aria-label="倍率を閉じる"
          className="fixed inset-0 z-30"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </header>
  );
}

function Stat({
  label,
  value,
  warn,
  always,
}: {
  label: string;
  value: string;
  warn?: boolean;
  always?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-elevated px-2.5 py-1",
        always ? "block" : "hidden sm:block",
      )}
    >
      <p className="text-[10px] tracking-wide text-faint">{label}</p>
      <p className={cn("text-sm tabular-nums leading-tight", warn ? "text-danger" : "text-fg")}>{value}</p>
    </div>
  );
}

function IconBtn({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-11 place-items-center rounded-sm border transition-colors duration-150",
        active ? "border-accent bg-accent text-accent-fg" : "border-border bg-elevated text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
