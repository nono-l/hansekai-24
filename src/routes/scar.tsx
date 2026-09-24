import { ScarDungeon } from "@/components/game/ScarDungeon";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/scar")({
  head: () => ({
    meta: [
      { title: "魔王の爪痕 — 半世界24" },
      { name: "description", content: "金が足りない店主が降りる、爪の痕のローグライク。" },
    ],
  }),
  component: ScarDungeon,
});
