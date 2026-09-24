import { ENDINGS, FEAT_IDS, FINAL_DAY, portraitSrc, SPRITE } from "@/game/data";
import { useGame } from "@/game/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function EventModal() {
  const game = useGame((s) => s.game);
  const choose = useGame((s) => s.chooseEvent);
  const ev = game?.pendingEvent;
  if (!game || !ev) return null;
  const portrait = ev.portrait ? portraitSrc(ev.portrait) : SPRITE.manager;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-3 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-bg/75" />
      <div
        role="dialog"
        aria-labelledby="event-title"
        className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex items-start gap-4">
          <img src={portrait} alt="" className="size-20 object-contain sm:size-24" crossOrigin="anonymous" />
          <div className="min-w-0">
            <p className="text-[11px] tracking-wide text-accent">出来事</p>
            <h2 id="event-title" className="font-display text-2xl text-fg">
              {ev.title}
            </h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">{ev.body}</p>
        <div className="mt-5 space-y-2">
          {ev.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => choose(c.id)}
              className="flex min-h-12 w-full flex-col items-start rounded-md border border-border bg-elevated px-4 py-2.5 text-left hover:border-accent"
            >
              <span className="text-sm text-fg">{c.label}</span>
              {c.hint ? <span className="text-xs text-faint">{c.hint}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScenarioClear() {
  const game = useGame((s) => s.game);
  const continueEndless = useGame((s) => s.continueEndless);
  const retire = useGame((s) => s.retire);
  const copyChronicle = useGame((s) => s.copyChronicle);
  if (!game?.clearModal) return null;
  const legend = game.clearModal === "legend";
  const rank = legend ? ENDINGS.legend : ENDINGS[game.scenarioEnding ?? "survive"];
  const featCount = FEAT_IDS.filter((id) => game.feats[id]).length;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <img src={SPRITE.title} alt="" className="absolute inset-0 size-full object-cover" crossOrigin="anonymous" />
      <div className="absolute inset-0 bg-bg/80" />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs tracking-[0.2em] text-accent">{legend ? "覇業達成" : "シナリオクリア"}</p>
        <h2 className="mt-2 font-display text-3xl text-fg">{rank.title}</h2>
        <p className="mt-3 font-display text-lg leading-relaxed text-fg">{rank.kicker}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {legend
            ? rank.body
            : `${FINAL_DAY}の夜を開けた。人族の物語は、ここで一度閉じる。魔物たちの生存戦争は、まだ朝を迎えていない。`}
        </p>
        {legend ? null : (
          <ul className="mt-4 space-y-1 text-xs text-faint">
            <li>誘致上限が伸びる。設備ももう一段。襲撃は本気になる。</li>
            <li>覇業が開く。十一旗、統一、百日、片目の黙認。</li>
          </ul>
        )}
        <p className="mt-4 text-xs tabular-nums text-faint">
          {game.day}日目 · 所持金 {game.gold}G · 覇業 {featCount}/{FEAT_IDS.length}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="min-h-12 flex-1" onClick={continueEndless}>
              {legend ? "まだ開けておく" : "やりこみを続ける"}
            </Button>
            <Button variant="secondary" className="min-h-12 flex-1" onClick={retire}>
              {legend ? "歴史を閉じる" : "ここで店を閉じる"}
            </Button>
          </div>
          <Button variant="ghost" className="min-h-12 w-full" onClick={copyChronicle}>
            日誌をコピー
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EndingScreen() {
  const game = useGame((s) => s.game);
  const startNew = useGame((s) => s.startNew);
  const toTitle = useGame((s) => s.toTitle);
  const copyChronicle = useGame((s) => s.copyChronicle);
  if (!game?.ending) return null;
  const e = ENDINGS[game.ending];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <img src={SPRITE.title} alt="" className="absolute inset-0 size-full object-cover" crossOrigin="anonymous" />
      <div className="absolute inset-0 bg-bg/80" />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-surface p-6 sm:p-8">
        <p className={cn("text-xs tracking-[0.2em]", e.win ? "text-accent" : "text-danger")}>
          {e.win ? "結末" : "閉店"}
        </p>
        <h2 className="mt-2 font-display text-3xl text-fg">{e.title}</h2>
        <p className="mt-3 font-display text-lg leading-relaxed text-fg">{e.kicker}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{e.body}</p>
        <p className="mt-4 text-xs tabular-nums text-faint">
          {game.day}日目 · 所持金 {game.gold}G · 客 {game.visitSeq}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="min-h-12 flex-1" onClick={startNew}>
              もう一度開店
            </Button>
            <Button variant="secondary" className="min-h-12 flex-1" onClick={toTitle}>
              看板へ
            </Button>
          </div>
          <Button variant="ghost" className="min-h-12 w-full" onClick={copyChronicle}>
            この店の物語をコピー
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.ui.toast);
  const clear = useGame((s) => s.clearToast);
  if (!toast) return null;
  return (
    <button
      type="button"
      onClick={clear}
      className="fixed bottom-20 left-1/2 z-30 max-w-[min(92vw,28rem)] -translate-x-1/2 rounded-md border border-border bg-elevated px-4 py-2.5 text-sm text-fg shadow-lg sm:bottom-6"
    >
      {toast}
    </button>
  );
}

export function NewsTicker() {
  const news = useGame((s) => s.game?.news ?? []);
  const copyChronicle = useGame((s) => s.copyChronicle);
  if (news.length === 0) return null;
  const latest = news[0]!;
  return (
    <div className="hidden items-center gap-2 border-t border-border bg-surface px-4 py-2 sm:flex">
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          latest.tone === "danger"
            ? "text-danger"
            : latest.tone === "ok"
              ? "text-ok"
              : latest.tone === "warn"
                ? "text-warn"
                : "text-muted",
        )}
      >
        <span className="mr-2 text-faint tabular-nums">
          {latest.day}日 {String(latest.hour).padStart(2, "0")}時
        </span>
        {latest.text}
      </p>
      <button
        type="button"
        onClick={copyChronicle}
        className="shrink-0 rounded-sm px-2 py-1 text-xs text-accent hover:bg-accent/15"
      >
        日誌をコピー
      </button>
    </div>
  );
}
