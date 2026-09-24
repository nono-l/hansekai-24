import { Button } from "@/components/ui/button";
import { BUILD_STAMP } from "@/lib/build";
import { useGame } from "@/game/store";
import type { DebugKind } from "@/game/types";
import { cn } from "@/lib/cn";

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

export function SettingsSheet() {
  const game = useGame((s) => s.game);
  const debug = useGame((s) => s.ui.debug);
  const setDebug = useGame((s) => s.setDebug);
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
            <p className="text-sm text-fg">デバッグモード</p>
            <p className="mt-0.5 text-xs text-muted">店内に数値と経路が出る。チートは営業中だけ。</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={debug}
            aria-label="デバッグモード"
            onClick={() => setDebug(!debug)}
            className={cn(
              "relative h-11 w-16 shrink-0 rounded-full border transition-colors",
              debug ? "border-accent bg-accent" : "border-border bg-bg",
            )}
          >
            <span
              className={cn(
                "absolute top-1 size-8 rounded-full bg-fg transition-transform",
                debug ? "translate-x-7" : "translate-x-1",
              )}
            />
          </button>
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
                {game.day}日目 {String(game.hour).padStart(2, "0")}時 · rng {game.rng}
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
