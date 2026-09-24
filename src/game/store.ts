import { create } from "zustand";
import { HOUR_SECONDS } from "./data";
import { loadDebug, saveDebug } from "./debug";
import { playChime, playCoin, playWarn, unlockAudio } from "./audio";
import { buildNovelPrompt } from "./chronicle";
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
  tickHour,
} from "./sim";
import type { CampaignKind, DebugKind, DenId, FacilityId, GameState, PatronId, PlaySpeed, ProductId, StaffId, TabId, WarlordId } from "./types";
import type { CatalogId } from "./layout";

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

const initialUi: UIState = {
  tab: "floor",
  panel: "stock",
  selectedDen: "radaan",
  toast: null,
  howTo: false,
  settings: false,
  confirmNew: false,
  debug: loadDebug(),
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
    const game = createInitialState();
    persist(game);
    set({ game, saved: true, ui: { ...initialUi, debug: loadDebug() } });
  },
  continueSave: () => {
    unlockAudio();
    acc.current = 0;
    const loaded = loadGame();
    if (!loaded) return;
    if (loaded.phase === "intro") {
      set({ game: loaded, saved: true, ui: { ...initialUi, debug: loadDebug() } });
      return;
    }
    loaded.phase = loaded.ending ? "ending" : "playing";
    if (loaded.pendingEvent || loaded.ending || loaded.clearModal) loaded.speed = 0;
    else if (!(loaded.speed > 0)) loaded.speed = loaded.heldSpeed > 0 ? loaded.heldSpeed : 1;
    set({ game: loaded, saved: true, ui: { ...initialUi, tab: "floor", debug: loadDebug() } });
  },
  finishIntro: () => {
    const { game } = get();
    if (!game) return;
    const next = beginPlay(game);
    persist(next);
    set({ game: next });
  },
  tick: (dt) => {
    const { game } = get();
    if (!game || game.phase !== "playing" || game.pendingEvent || game.ending || game.clearModal) return;
    if (game.speed === 0) return;
    acc.current += dt * game.speed;
    let g = game;
    let stepped = false;
    while (acc.current >= HOUR_SECONDS) {
      acc.current -= HOUR_SECONDS;
      g = tickHour(g);
      stepped = true;
      if (g.pendingEvent || g.ending || g.clearModal) {
        acc.current = 0;
        break;
      }
    }
    if (!stepped) return;
    if (g.pendingEvent) playWarn();
    if (g.hour === 0) persist(g);
    set({ game: g });
  },
  setSpeed: (s) => {
    const { game } = get();
    if (!game) return;
    set({ game: setSpeed(game, s) });
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
    set({ game: null, saved: hasSave(), ui: { ...initialUi, debug: loadDebug() } });
  },
  setHowTo: (v) => set({ ui: { ...get().ui, howTo: v } }),
  setSettings: (v) => set({ ui: { ...get().ui, settings: v } }),
  setDebug: (v) => {
    saveDebug(v);
    set({ ui: { ...get().ui, debug: v, toast: v ? "デバッグを点けた。" : "デバッグを消した。" } });
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
    applyAction(set, get, placeFixture(game, ui.designTool, x, y), "coin");
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
    const { game } = get();
    if (!game) return;
    const v = game.lastVisits.find((x) => x.seq === seq);
    if (!v || v.left) return;
    set({ game: markGuestLeft(game, seq) });
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
