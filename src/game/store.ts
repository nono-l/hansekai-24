import { create } from "zustand";
import { MINUTE_SECONDS } from "./data";
import { loadDebug, saveDebug } from "./debug";
import { loadHelp, saveHelp } from "./help";
import { armCoach, isCoachMuted, loadCoachMute, loadTutorial, pickCoach, saveCoachMute, saveTutorial, shelfWaitStatus, unpauseCoach } from "./tutorial";
import { playChime, playCoin, playWarn, unlockAudio } from "./audio";
import { buildNovelPrompt } from "./chronicle";
import { noteScarGold, takeScarStash } from "./scar/purse";
import { hasSave, loadGame, saveGame } from "./save";
import {
  applyEventChoice,
  attractDen,
  beginPlay,
  breakContract,
  buildFacility,
  createInitialState,
  debugAct as runDebug,
  enterEndless,
  fireStaff,
  giftFaction,
  hireStaff,
  moveFixture,
  namePatron as giveTrueName,
  orderStock,
  pickAtShelf,
  payAtRegister,
  placeFixture,
  removeFixture,
  guestLeave as markGuestLeft,
  retireRun,
  rotateFixture,
  setShelfPolicy as changeShelfPolicy,
  setSpeed,
  signContract,
  startCampaign,
  tickMinute,
  closeCoach,
  closeDayHint,
} from "./sim";
import type { CampaignKind, DebugKind, DenId, FacilityId, GameState, PatronId, PlaySpeed, ProductId, StaffId, TabId, WarlordId } from "./types";
import type { CatalogId } from "./layout";
import { CATALOG, countProductShelf } from "./layout";

export type PanelId = "stock" | "people" | "court";

interface UIState {
  tab: TabId;
  panel: PanelId;
  selectedDen: DenId;
  toast: string | null;
  howTo: boolean;
  settings: boolean;
  confirmNew: boolean;
  debug: boolean;
  help: boolean;
  tutorial: boolean;
  coachMute: Record<string, boolean>;
  rush: boolean;
  designing: boolean;
  designTool: CatalogId | "sell" | null;
  holding: number | null;
}

interface GameStore {
  game: GameState | null;
  ui: UIState;
  saved: boolean;
  startNew: () => void;
  continueSave: () => void;
  finishIntro: () => void;
  tick: (dt: number) => void;
  setSpeed: (s: PlaySpeed) => void;
  setTab: (t: TabId) => void;
  setPanel: (p: PanelId) => void;
  selectDen: (id: DenId) => void;
  order: (id: ProductId, qty: number) => void;
  attract: (id: DenId) => void;
  hire: (id: StaffId) => void;
  fire: (id: StaffId) => void;
  build: (id: FacilityId) => void;
  campaign: (kind: Exclude<CampaignKind, null>) => void;
  gift: (id: WarlordId) => void;
  contract: (id: WarlordId) => void;
  uncontract: () => void;
  chooseEvent: (choice: string) => void;
  continueEndless: () => void;
  retire: () => void;
  toTitle: () => void;
  setHowTo: (v: boolean) => void;
  setSettings: (v: boolean) => void;
  setDebug: (v: boolean) => void;
  setHelp: (v: boolean) => void;
  setTutorial: (v: boolean) => void;
  setCoachMuted: (id: string, muted: boolean) => void;
  setRush: (v: boolean) => void;
  dismissCoach: () => void;
  dismissHint: () => void;
  debugDo: (kind: DebugKind) => void;
  setConfirmNew: (v: boolean) => void;
  clearToast: () => void;
  setDesigning: (v: boolean) => void;
  setDesignTool: (t: CatalogId | "sell" | null) => void;
  placeAt: (x: number, y: number) => void;
  pickupFixture: (uid: number) => void;
  rotateHeld: () => void;
  sellFixture: (uid: number) => void;
  setShelfPolicy: (uid: number, patch: { capacity?: number; reorderBelow?: number }) => void;
  guestPick: (seq: number, shelfUid?: number) => void;
  guestPay: (seq: number) => void;
  guestLeave: (seq: number) => void;
  nameGuest: (patronId: PatronId, name: string) => void;
  copyChronicle: () => void;
}

const acc = { current: 0 };
const RUSH_KEY = "hansekai24-rush";

function loadRush(): boolean {
  try {
    return localStorage.getItem(RUSH_KEY) === "1";
  } catch {
    return false;
  }
}

function saveRush(on: boolean) {
  try {
    localStorage.setItem(RUSH_KEY, on ? "1" : "0");
  } catch {
    // private mode
  }
}

function crowdPace(g: GameState, rush: boolean): GameState {
  if (!rush || g.speed === 0) return g;
  if (g.phase !== "playing" || g.pendingEvent || g.ending || g.clearModal || g.coach || g.dayHint || g.coachWait) return g;
  const inside = g.lastVisits.some((v) => !v.left);
  const want: PlaySpeed = inside ? 1 : 20;
  if (g.speed === want) return g;
  return { ...g, speed: want };
}

const initialUi: UIState = {
  tab: "floor",
  panel: "stock",
  selectedDen: "radaan",
  toast: null,
  howTo: false,
  settings: false,
  confirmNew: false,
  debug: loadDebug(),
  help: loadHelp(),
  tutorial: loadTutorial(),
  coachMute: loadCoachMute(),
  rush: loadRush(),
  designing: false,
  designTool: null,
  holding: null,
};

function persist(game: GameState) {
  saveGame(game);
}

function applyAction(
  set: (p: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  result: { ok: true; state: GameState; message?: string } | { ok: false; error: string },
  sound: "coin" | "chime" | "warn" | null,
) {
  if (!result.ok) {
    playWarn();
    set({ ui: { ...get().ui, toast: result.error } });
    return;
  }
  if (sound === "coin") playCoin();
  if (sound === "chime") playChime();
  if (sound === "warn") playWarn();
  persist(result.state);
  set({ game: result.state, ui: { ...get().ui, toast: result.message ?? null } });
}

export const useGame = create<GameStore>((set, get) => ({
  game: null,
  ui: initialUi,
  saved: false,
  startNew: () => {
    unlockAudio();
    acc.current = 0;
    const game = noteScarGold(createInitialState(), takeScarStash());
    persist(game);
    set({ game, saved: true, ui: { ...initialUi, debug: loadDebug(), help: loadHelp(), tutorial: loadTutorial() } });
  },
  continueSave: () => {
    unlockAudio();
    acc.current = 0;
    const raw = loadGame();
    if (!raw) return;
    const stash = takeScarStash();
    const loaded = noteScarGold(raw, stash);
    if (stash) persist(loaded);
    if (!loaded) return;
    if (loaded.phase === "intro") {
      set({ game: loaded, saved: true, ui: { ...initialUi, debug: loadDebug(), help: loadHelp(), tutorial: loadTutorial() } });
      return;
    }
    loaded.phase = loaded.ending ? "ending" : "playing";
    if (loaded.pendingEvent || loaded.ending || loaded.clearModal) loaded.speed = 0;
    else if (loaded.dayHint && loadHelp()) {
      if (loaded.speed > 0) {
        loaded.heldSpeed = loaded.speed;
        loaded.dayHint = { ...loaded.dayHint, resume: true };
      }
      loaded.speed = 0;
    } else if (loaded.dayHint) loaded.dayHint = null;
    else if (loaded.coach && !loadTutorial()) {
      loaded.coach = null;
      if (!(loaded.speed > 0)) loaded.speed = loaded.heldSpeed > 0 ? loaded.heldSpeed : 1;
    } else if (loaded.coach) loaded.speed = 0;
    else if (!(loaded.speed > 0)) loaded.speed = loaded.heldSpeed > 0 ? loaded.heldSpeed : 1;
    set({ game: loaded, saved: true, ui: { ...initialUi, tab: "floor", debug: loadDebug(), help: loadHelp(), tutorial: loadTutorial() } });
  },
  finishIntro: () => {
    const { game } = get();
    if (!game) return;
    let next = beginPlay(game);
    if (loadTutorial()) {
      const coach = pickCoach(next);
      if (coach) next = armCoach(next, coach);
    }
    persist(next);
    set({ game: next });
  },
  tick: (dt) => {
    const { game, ui } = get();
    if (!game || game.phase !== "playing" || game.pendingEvent || game.ending || game.clearModal) return;
    if (game.dayHint && ui.help) {
      if (game.dayHint.resume == null && game.speed > 0) {
        const next = {
          ...game,
          heldSpeed: game.speed,
          speed: 0 as const,
          dayHint: { ...game.dayHint, resume: true },
        };
        persist(next);
        set({ game: next });
      }
      return;
    }
    if (game.coach && ui.tutorial) return;
    if (game.speed === 0) {
      if (game.coach && !ui.tutorial) {
        const next = closeCoach(game);
        persist(next);
        set({ game: next });
      }
      return;
    }
    let pace = crowdPace(game, ui.rush);
    acc.current += dt * pace.speed;
    let g = pace.dayHint && !ui.help ? { ...pace, dayHint: null, helpQueue: [] } : pace;
    let stepped = g !== game;
    while (acc.current >= MINUTE_SECONDS) {
      acc.current -= MINUTE_SECONDS;
      g = tickMinute(g);
      stepped = true;
      if (g.pendingEvent || g.ending || g.clearModal || (g.dayHint && ui.help)) {
        acc.current = 0;
        break;
      }
      if (ui.tutorial) {
        const coach = pickCoach(g);
        if (coach) {
          g = armCoach(g, coach);
          acc.current = 0;
          break;
        }
      }
      if (ui.rush && g.lastVisits.some((v) => !v.left)) {
        g = { ...g, speed: 1 };
        acc.current = 0;
        break;
      }
    }
    if (ui.rush) g = crowdPace(g, true);
    if (!stepped && g === game) return;
    if (g.dayHint && !ui.help) g = { ...g, dayHint: null, helpQueue: [] };
    if (g.pendingEvent) playWarn();
    if (g.hour === 0 || g.dayHint || g.coach) persist(g);
    set({ game: g });
  },
  setSpeed: (s) => {
    const { game } = get();
    if (!game) return;
    if (game.coach || game.coachWait === "shelves") return;
    const next = setSpeed(game, s);
    set({ game: s > 0 ? crowdPace(next, get().ui.rush) : next });
  },
  setTab: (t) => {
    const { game, ui } = get();
    if (game && t === "map" && !game.tutorial.openedMap) {
      const next = { ...game, tutorial: { ...game.tutorial, openedMap: true } };
      set({ game: next, ui: { ...ui, tab: t } });
      return;
    }
    set({ ui: { ...ui, tab: t } });
  },
  setPanel: (p) => set({ ui: { ...get().ui, panel: p } }),
  selectDen: (id) => set({ ui: { ...get().ui, selectedDen: id, tab: "map" } }),
  order: (id, qty) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, orderStock(game, id, qty), "coin");
  },
  attract: (id) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, attractDen(game, id), "chime");
  },
  hire: (id) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, hireStaff(game, id), "chime");
  },
  fire: (id) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, fireStaff(game, id), "warn");
  },
  build: (id) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, buildFacility(game, id), "coin");
  },
  campaign: (kind) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, startCampaign(game, kind), "chime");
  },
  gift: (id) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, giftFaction(game, id), "coin");
  },
  contract: (id) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, signContract(game, id), "warn");
  },
  uncontract: () => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, breakContract(game), "warn");
  },
  chooseEvent: (choice) => {
    const { game } = get();
    if (!game) return;
    const next = applyEventChoice(game, choice);
    persist(next);
    set({ game: next });
  },
  continueEndless: () => {
    const { game } = get();
    if (!game || !game.clearModal) return;
    const next = enterEndless(game);
    persist(next);
    playChime();
    set({ game: next });
  },
  retire: () => {
    const { game } = get();
    if (!game) return;
    const next = retireRun(game);
    persist(next);
    playWarn();
    set({ game: next });
  },
  toTitle: () => {
    const { game } = get();
    if (game) persist(game);
    acc.current = 0;
    set({ game: null, saved: hasSave(), ui: { ...initialUi, debug: loadDebug(), help: loadHelp(), tutorial: loadTutorial() } });
  },
  setHowTo: (v) => set({ ui: { ...get().ui, howTo: v } }),
  setSettings: (v) => set({ ui: { ...get().ui, settings: v } }),
  setDebug: (v) => {
    saveDebug(v);
    set({ ui: { ...get().ui, debug: v, toast: v ? "デバッグを点けた。" : "デバッグを消した。" } });
  },
  setHelp: (v) => {
    saveHelp(v);
    const { game, ui } = get();
    const nextGame = !v && game?.dayHint ? { ...game, dayHint: null, helpQueue: [] } : game;
    if (nextGame && nextGame !== game) persist(nextGame);
    set({
      game: nextGame,
      ui: { ...ui, help: v, toast: v ? "初心者ヘルプを点けた。" : "初心者ヘルプを消した。" },
    });
  },
  dismissHint: () => {
    const { game } = get();
    if (!game?.dayHint) return;
    const next = crowdPace(closeDayHint(game), get().ui.rush);
    persist(next);
    set({ game: next });
  },
  setTutorial: (v) => {
    saveTutorial(v);
    const { game, ui } = get();
    const nextGame = !v && game?.coach ? closeCoach(game) : game;
    let released = nextGame;
    if (!v && released?.coachWait) {
      released = {
        ...released,
        coachWait: null,
        speed: released.speed > 0 ? released.speed : released.heldSpeed > 0 ? released.heldSpeed : 1,
      };
    }
    if (released && released !== game) persist(released);
    set({
      game: released,
      ui: { ...ui, tutorial: v, toast: v ? "チュートリアルを点けた。" : "オフにした。設定から、もう一度有効にできる。" },
    });
  },
  setCoachMuted: (id, muted) => {
    const { game, ui } = get();
    const coachMute = { ...ui.coachMute };
    if (muted) coachMute[id] = true;
    else delete coachMute[id];
    saveCoachMute(coachMute);
    let next = game;
    if (muted && game?.coach?.id === id) {
      next = closeCoach(game, false);
      if (next.coachWait) {
        next = {
          ...next,
          coachWait: null,
          speed: next.speed > 0 ? next.speed : next.heldSpeed > 0 ? next.heldSpeed : 1,
        };
      }
      persist(next);
    }
    set({
      game: next,
      ui: {
        ...ui,
        coachMute,
        toast: muted ? "この案内は出さない。設定から、また出せる。" : "この案内を、また出す。",
      },
    });
  },
  setRush: (v) => {
    saveRush(v);
    const { game, ui } = get();
    let next = game;
    if (next && next.speed > 0) {
      next = v ? crowdPace(next, true) : setSpeed(next, next.heldSpeed > 0 ? next.heldSpeed : 1);
    }
    set({
      game: next,
      ui: {
        ...ui,
        rush: v,
        toast: v ? "客がいないあいだは20倍。店にいるあいだは等倍。" : "速度の自動切替を切った。",
      },
    });
  },
  dismissCoach: () => {
    const { game, ui } = get();
    if (!game?.coach) return;
    const hold = game.coach.id === "shelves";
    const next = closeCoach(game, hold);
    const paced = hold ? next : crowdPace(next, ui.rush);
    persist(paced);
    set({
      game: paced,
      ui: hold ? { ...ui, designing: true, tab: "floor", designTool: null, holding: null } : ui,
    });
  },
  debugDo: (kind) => {
    const { game, ui } = get();
    if (!game || !ui.debug) return;
    applyAction(set, get, runDebug(game, kind), kind === "gold" ? "coin" : "chime");
  },
  setConfirmNew: (v) => set({ ui: { ...get().ui, confirmNew: v } }),
  clearToast: () => set({ ui: { ...get().ui, toast: null } }),
  setDesigning: (v) =>
    set({
      ui: {
        ...get().ui,
        designing: v,
        tab: "floor",
        designTool: v ? get().ui.designTool : null,
        holding: v ? get().ui.holding : null,
      },
    }),
  setDesignTool: (t) => set({ ui: { ...get().ui, designTool: t, holding: t ? null : get().ui.holding, designing: true, tab: "floor" } }),
  placeAt: (x, y) => {
    const { game, ui } = get();
    if (!game) return;
    if (ui.holding != null) {
      const result = moveFixture(game, ui.holding, x, y);
      applyAction(set, get, result, result.ok ? "chime" : null);
      if (result.ok) set({ ui: { ...get().ui, holding: null } });
      return;
    }
    if (!ui.designTool || ui.designTool === "sell") return;
    const tool = ui.designTool;
    const catalog = CATALOG.find((c) => c.id === tool);
    const firstShelf = !!catalog?.product && countProductShelf(game.layout, catalog.product) === 0;
    const result = placeFixture(game, tool, x, y);
    applyAction(set, get, result, "coin");
    const after = get();
    const placed = after.game;
    let nextUi = after.ui;
    if (result.ok && firstShelf) nextUi = { ...nextUi, designTool: null };
    if (!placed || !nextUi.tutorial || placed.coachWait !== "shelves" || placed.coach) {
      if (result.ok && firstShelf) set({ ui: nextUi });
      return;
    }
    const status = shelfWaitStatus(placed);
    if (!status) {
      if (result.ok && firstShelf) set({ ui: nextUi });
      return;
    }
    if (isCoachMuted("unpause")) {
      const speed = placed.heldSpeed > 0 ? placed.heldSpeed : 1;
      const next = { ...placed, coachWait: null, speed };
      persist(next);
      set({ game: next, ui: { ...nextUi, designing: false, designTool: null, holding: null } });
      return;
    }
    const next = armCoach(placed, unpauseCoach(status), { resume: true });
    persist(next);
    set({ game: next, ui: { ...nextUi, designing: false, designTool: null, holding: null } });
  },
  pickupFixture: (uid) => {
    const { game, ui } = get();
    if (!game) return;
    if (ui.designTool === "sell") {
      applyAction(set, get, removeFixture(game, uid), "warn");
      return;
    }
    set({ ui: { ...ui, holding: uid, designTool: null, designing: true } });
  },
  rotateHeld: () => {
    const { game, ui } = get();
    if (!game || ui.holding == null) return;
    applyAction(set, get, rotateFixture(game, ui.holding), null);
  },
  sellFixture: (uid) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, removeFixture(game, uid), "warn");
    set({ ui: { ...get().ui, holding: get().ui.holding === uid ? null : get().ui.holding } });
  },
  setShelfPolicy: (uid, patch) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, changeShelfPolicy(game, uid, patch), null);
  },
  guestPick: (seq, shelfUid) => {
    const { game } = get();
    if (!game) return;
    const v = game.lastVisits.find((x) => x.seq === seq);
    if (!v || v.picked) return;
    set({ game: pickAtShelf(game, seq, shelfUid) });
  },
  guestPay: (seq) => {
    const { game } = get();
    if (!game) return;
    const v = game.lastVisits.find((x) => x.seq === seq);
    if (!v || v.paid || !v.picked) return;
    const next = payAtRegister(game, seq);
    const done = next.lastVisits.find((x) => x.seq === seq);
    if (done?.paid && (done.bought ?? 0) > 0) playCoin();
    set({ game: next });
  },
  guestLeave: (seq) => {
    const { game, ui } = get();
    if (!game) return;
    const v = game.lastVisits.find((x) => x.seq === seq);
    if (!v || v.left) return;
    const next = crowdPace(markGuestLeft(game, seq), ui.rush);
    set({ game: next });
  },
  nameGuest: (patronId, name) => {
    const { game } = get();
    if (!game) return;
    applyAction(set, get, giveTrueName(game, patronId, name), "chime");
  },
  copyChronicle: () => {
    const { game } = get();
    if (!game) return;
    const text = buildNovelPrompt(game);
    const ok = () => {
      playChime();
      set({ ui: { ...get().ui, toast: "日誌をコピーした。LLMに貼れば小説になる。" } });
    };
    const fail = () => {
      playWarn();
      set({ ui: { ...get().ui, toast: "コピーできなかった。もう一度押してくれ。" } });
    };
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(ok).catch(fail);
      return;
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const copied = document.execCommand("copy");
      ta.remove();
      if (copied) ok();
      else fail();
    } catch {
      fail();
    }
  },
}));

export function hydrateSaveFlag() {
  useGame.setState({ saved: hasSave() });
}
