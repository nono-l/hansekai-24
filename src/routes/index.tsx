import { createFileRoute } from "@tanstack/react-router";
import { GameShell } from "@/components/game/GameShell";
import { IntroCrawl, TitleScreen } from "@/components/game/TitleScreen";
import { useGame } from "@/game/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const game = useGame((s) => s.game);
  if (!game) return <TitleScreen />;
  if (game.phase === "intro") return <IntroCrawl />;
  return <GameShell />;
}
