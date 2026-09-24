import { Button } from "@/components/ui/button";
import { BUILD_STAMP } from "@/lib/build";
import { COACH_TIPS } from "@/game/tutorial";
import { useGame } from "@/game/store";
import type { DebugKind } from "@/game/types";
import { cn } from "@/lib/cn";
import { useRef, useState } from "react";

const CHEATS: { id: DebugKind; label: string }[] = [
  { id: "hour", label: "1時間進める" },
  { id: "day", label: "1日進める" },
  { id: "gold", label: "+500G" },
  { id: "hp", label: "店HPを満タン" },
  { id: "emp", label: "黙認を厚く" },
  { id: "heat", label: "戦争熱を冷ます" },
  { id: "scrap", label: "見切りを満タン" },
  { id: "shelves", label: "棚を満タン" },
  { id: "visit", label: "客を呼ぶ" },
];

export function DebugHover() {
  const game = useGame((s) => s.game);
  const debug = useGame((s) => s.ui.debug);
  const debugDo = useGame((s) => s.debugDo);
  const [pos, setPos] = useState({ x: 16, y: 68 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  if (!debug || game?.phase !== "playing") return null;

  const move = (clientX: number, clientY: number) => {
    const d = drag.current;
    if (!d) return;
    const maxX = Math.max(8, window.innerWidth - 200);
    const maxY = Math.max(8, window.innerHeight - 96);
    setPos({
      x: Math.min(maxX, Math.max(8, d.x + clientX - d.px)),
      y: Math.min(maxY, Math.max(8, d.y + clientY - d.py)),
    });
  };

  return (
    <div
      className="fixed z-[45] w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-surface/95 p-2 shadow-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="cursor-grab touch-none px-1 pb-2 text-[11px] tracking-wide text-faint active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        チート · ドラッグで移動
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CHEATS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => debugDo(c.id)}
            className="min-h-11 rounded-sm border border-border bg-elevated px-2 text-sm text-fg"
          >
            {c.label}
          </button>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 px-1 text-[11px] tabular-nums text-muted">
        <li>
          {game.day}日目 {String(game.hour).padStart(2, "0")}:{String(game.minute ?? 0).padStart(2, "0")} · rng {game.rng}
        </li>
        <li>
          客 {game.lastVisits.filter((v) => !v.left).length} · 今日 {game.guestsToday} / 欠 {game.missedToday}
        </li>
        <li>
          売上 {game.goldToday}G · 所持 {game.gold}G
        </li>
      </ul>
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative h-11 w-16 shrink-0 rounded-full border transition-colors",
        on ? "border-accent bg-accent" : "border-border bg-bg",
      )}
    >
      <span
        className={cn(
          "absolute top-1.5 left-1 size-8 rounded-full bg-fg transition-transform",
          on && "translate-x-6",
        )}
      />
    </button>
  );
}

export function SettingsSheet() {
  const game = useGame((s) => s.game);
  const debug = useGame((s) => s.ui.debug);
  const help = useGame((s) => s.ui.help);
  const tutorial = useGame((s) => s.ui.tutorial);
  const rush = useGame((s) => s.ui.rush);
  const coachMute = useGame((s) => s.ui.coachMute);
  const setDebug = useGame((s) => s.setDebug);
  const setHelp = useGame((s) => s.setHelp);
  const setTutorial = useGame((s) => s.setTutorial);
  const setRush = useGame((s) => s.setRush);
  const setCoachMuted = useGame((s) => s.setCoachMuted);
  const debugDo = useGame((s) => s.debugDo);
  const onClose = useGame((s) => s.setSettings);
  const playing = game?.phase === "playing";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button className="absolute inset-0 bg-bg/70" aria-label="閉じる" onClick={() => onClose(false)} />
      <div
        role="dialog"
        aria-labelledby="settings-title"
        className="relative max-h-[min(90dvh,40rem)] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 id="settings-title" className="font-display text-2xl text-fg">
          設定
        </h2>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-border bg-elevated px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm text-fg">チュートリアル</p>
            <p className="mt-0.5 text-xs text-muted">今できることがあると時間を止めて案内する。放っておくと、また止まる。</p>
          </div>
          <Toggle on={tutorial} label="チュートリアル" onClick={() => setTutorial(!tutorial)} />
        </div>
        {tutorial ? (
          <ul className="mt-2 space-y-1 rounded-md border border-border bg-elevated px-3 py-2">
            {COACH_TIPS.map((tip) => {
              const on = coachMute[tip.id] !== true;
              return (
                <li key={tip.id} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-xs text-fg">{tip.label}</span>
                  <Toggle on={on} label={tip.label} onClick={() => setCoachMuted(tip.id, on)} />
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-border bg-elevated px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm text-fg">初心者ヘルプ</p>
            <p className="mt-0.5 text-xs text-muted">一日の終わりと、襲撃や契約旗の敗北のあとに、どうすればよかったかを出す。</p>
          </div>
          <Toggle on={help} label="初心者ヘルプ" onClick={() => setHelp(!help)} />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-border bg-elevated px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm text-fg">客がいないときは最高速</p>
            <p className="mt-0.5 text-xs text-muted">店に客がいるあいだは等倍。最後の客が出ると20倍。止めているあいだは動かさない。</p>
          </div>
          <Toggle on={rush} label="客がいないときは最高速" onClick={() => setRush(!rush)} />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-md border border-border bg-elevated px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm text-fg">デバッグモード</p>
            <p className="mt-0.5 text-xs text-muted">店内に数値と経路が出る。チートは店の画面に浮かぶ。見出しを掴んで移せる。</p>
          </div>
          <Toggle on={debug} label="デバッグモード" onClick={() => setDebug(!debug)} />
        </div>
        {debug && playing ? (
          <div className="mt-5">
            <p className="text-xs tracking-wide text-faint">チート</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CHEATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => debugDo(c.id)}
                  className="min-h-11 rounded-sm border border-border bg-elevated px-2 text-sm text-fg"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <ul className="mt-3 space-y-0.5 text-xs tabular-nums text-muted">
              <li>
                {game.day}日目 {String(game.hour).padStart(2, "0")}:{String(game.minute ?? 0).padStart(2, "0")} · rng {game.rng}
              </li>
              <li>
                客 {game.lastVisits.filter((v) => !v.left).length} · 今日 {game.guestsToday} / 欠 {game.missedToday}
              </li>
              <li>
                売上 {game.goldToday}G · 所持 {game.gold}G
              </li>
            </ul>
          </div>
        ) : debug ? (
          <p className="mt-4 text-xs text-muted">開店すると、チートと数値がここに並ぶ。</p>
        ) : null}
        {BUILD_STAMP ? (
          <p className="mt-4 text-xs tabular-nums text-faint">ビルド {BUILD_STAMP}</p>
        ) : null}
        <Button className="mt-6 w-full min-h-11" onClick={() => onClose(false)}>
          閉じる
        </Button>
      </div>
    </div>
  );
}
