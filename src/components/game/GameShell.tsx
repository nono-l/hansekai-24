import { useEffect } from "react";
import { Handshake, Map, Package, Store, Users } from "lucide-react";
import { Hud } from "./Hud";
import { CourtPanel, PeoplePanel, StockPanel } from "./Panels";
import { StoreFloor } from "./StoreFloor";
import { WorldMap } from "./WorldMap";
import { EndingScreen, EventModal, NewsTicker, ScenarioClear, Toast } from "./Modals";
import { SettingsSheet } from "./Settings";
import { saveGame } from "@/game/save";
import { useGame } from "@/game/store";
import type { TabId } from "@/game/types";
import { cn } from "@/lib/cn";

const TABS: { id: TabId; label: string; icon: typeof Store }[] = [
  { id: "floor", label: "店内", icon: Store },
  { id: "map", label: "地図", icon: Map },
  { id: "stock", label: "棚", icon: Package },
  { id: "people", label: "経営", icon: Users },
  { id: "court", label: "内乱", icon: Handshake },
];

export function GameShell() {
  const tab = useGame((s) => s.ui.tab);
  const setTab = useGame((s) => s.setTab);
  const toast = useGame((s) => s.ui.toast);
  const settings = useGame((s) => s.ui.settings);
  const latest = useGame((s) => s.game?.news[0] ?? null);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      useGame.getState().tick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const onHide = () => {
      const g = useGame.getState().game;
      if (g) saveGame(g);
    };
    const vis = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => useGame.getState().clearToast(), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const mainIsMap = tab === "map";
  const side =
    tab === "stock" ? (
      <StockPanel />
    ) : tab === "people" ? (
      <PeoplePanel />
    ) : tab === "court" ? (
      <CourtPanel />
    ) : (
      <StockPanel />
    );

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-bg">
      <Hud />
      <div className="flex min-h-0 flex-1">
        <div className={cn("relative min-h-0 min-w-0 flex-1", tab !== "floor" && tab !== "map" && "hidden lg:block")}>
          {mainIsMap ? <WorldMap /> : <StoreFloor />}
        </div>
        <aside
          className={cn(
            "min-h-0 w-full flex-1 overflow-y-auto border-border bg-surface p-4 lg:w-[380px] lg:flex-none lg:border-l",
            (tab === "floor" || tab === "map") && "hidden lg:block",
          )}
        >
          {side}
        </aside>
      </div>
      <div className="border-t border-border bg-surface px-3 py-2 sm:hidden">
        {latest ? (
          <p
            className={cn(
              "truncate text-xs",
              latest.tone === "danger"
                ? "text-danger"
                : latest.tone === "ok"
                  ? "text-ok"
                  : latest.tone === "warn"
                    ? "text-warn"
                    : "text-muted",
            )}
          >
            {latest.text}
          </p>
        ) : null}
      </div>
      <NewsTicker />
      <nav className="grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                on ? "text-accent" : "text-faint",
              )}
            >
              <Icon className="size-5" />
              {t.label}
            </button>
          );
        })}
      </nav>
      <EventModal />
      <ScenarioClear />
      <EndingScreen />
      {settings ? <SettingsSheet /> : null}
      <Toast />
    </div>
  );
}
