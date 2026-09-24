import {
  CAMPAIGNS,
  DENS,
  DEN_IDS,
  ENDINGS,
  FACILITIES,
  FACTIONS,
  FACTION_IDS,
  FEATS,
  FEAT_IDS,
  FINAL_DAY,
  MONSTER_FACTION_IDS,
  MONSTER_WARLORD_IDS,
  MAX_HP,
  MAX_NEWS,
  MAX_CHRONICLE,
  MAX_TRUE_NAMES,
  MAX_SCRAP,
  PRODUCTS,
  PRODUCT_IDS,
  SAVE_VERSION,
  STAFF,
  WARLORDS,
  WARLORD_IDS,
  AUTO_ORDER_RATE,
  isDeliveryHour,
  maxAttract,
  patronLevelFromSpent,
  purseAtLevel,
  isPenniless,
  scrapPrice,
  nowStamp,
  stockCap,
  timeBand,
  totalStock,
} from "./data";
import { pick, poisson, rand, randInt } from "./rng";
import {
  CATALOG,
  catalogById,
  clearProduct,
  countKind,
  countProductShelf,
  defaultCap,
  faceCap,
  faceStock,
  firstFreeSlot,
  fixtureAt,
  gondolas,
  hasRegisterPath,
  hydrateGondolas,
  isDoor,
  isGondola,
  isWall,
  KIND_TO_FACILITY,
  layoutFromFacilities,
  onHand,
  pourWarehouseToShelves,
  putOnShelves,
  pushShelfLog,
  restockFromWarehouse,
  starterLayout,
  syncFacilities,
  takeProduct,
  totalOnHand,
  withShelfStock,
  type CatalogId,
} from "./layout";
import { PATRONS, PATRONS_BY_FACTION } from "./patrons";
import { seedChronicle } from "./chronicle";
import type {
  ActionResult,
  CampaignKind,
  DebugKind,
  DenId,
  EndingId,
  FacilityId,
  FactionId,
  FeatId,
  Fixture,
  FloorVisit,
  GameState,
  NewsItem,
  NewsTone,
  PatronId,
  PatronMemory,
  PendingEvent,
  ProductId,
  StaffId,
  VisitMood,
  WarlordId,
  PlaySpeed,
} from "./types";

function clone<T>(v: T): T {
  return structuredClone(v);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function emptyFeats(): Record<FeatId, boolean> {
  return Object.fromEntries(FEAT_IDS.map((id) => [id, false])) as Record<FeatId, boolean>;
}

function endlessAge(g: GameState): number {
  return g.era === "endless" ? Math.max(0, g.day - FINAL_DAY) : 0;
}

export function attractCap(g: GameState): number {
  return maxAttract(g.era);
}

export function facilityCap(g: GameState, id: FacilityId): number {
  const base = FACILITIES[id].max;
  if (g.era !== "endless") return base;
  if (id === "hotcase" || id === "wyvern") return base;
  return base + 1;
}

export function nextBuildCost(g: GameState, id: FacilityId): number {
  const f = FACILITIES[id];
  const lv = g.facilities[id];
  if (lv < f.costs.length) return f.costs[lv]!;
  const last = f.costs[f.costs.length - 1] ?? 400;
  return Math.round(last * 1.7);
}

function rankScenario(g: GameState): EndingId {
  if (MONSTER_FACTION_IDS.every((id) => g.factionRep[id] >= 62)) return "neutral";
  const live = MONSTER_WARLORD_IDS.filter((id) => warKnown(g, id));
  if (live.length) {
    const top = live.reduce((a, b) => (g.warlordPower[a] > g.warlordPower[b] ? a : b));
    if (
      g.warContract === top &&
      g.warlordPower[top] >= 82 &&
      g.gold >= 2800 &&
      attractedCount(g) >= 4
    ) {
      return "supply";
    }
  }
  if (g.gold >= 6500 && attractedCount(g) >= 5) return "economy";
  if (g.caveKnown && !g.caveSealed && g.dens.hollow >= 2 && g.factionRep.cave >= 66 && g.emperor > 12) {
    return "hollow";
  }
  return "survive";
}

function featHeld(g: GameState, id: FeatId): boolean {
  if (id === "banners") {
    return DEN_IDS.every((d) => {
      if (d === "hollow") return g.caveKnown && !g.caveSealed && g.dens.hollow >= 1;
      return g.dens[d] > 0;
    });
  }
  if (id === "unify") {
    const live = MONSTER_WARLORD_IDS.filter((w) => warKnown(g, w));
    if (!live.length) return false;
    const top = live.reduce((a, b) => (g.warlordPower[a] > g.warlordPower[b] ? a : b));
    const rest = live.filter((w) => w !== top);
    return g.warlordPower[top] >= 96 && rest.filter((w) => g.warlordPower[w] <= 42).length >= 6;
  }
  if (id === "market") return MONSTER_FACTION_IDS.every((f) => g.factionRep[f] >= 78);
  if (id === "empire") return g.gold >= 18000 || g.peakGold >= 18000;
  if (id === "century") return g.day >= 100;
  if (id === "mercy") return g.emperor >= 82;
  if (id === "depths") {
    return g.caveKnown && !g.caveSealed && g.dens.hollow >= 3 && g.factionRep.cave >= 75;
  }
  return false;
}

function evalFeats(g: GameState) {
  if (g.era !== "endless") return;
  for (const id of FEAT_IDS) {
    if (g.feats[id]) continue;
    if (!featHeld(g, id)) continue;
    g.feats[id] = true;
    pushNews(g, `覇業『${FEATS[id].name}』。${FEATS[id].blurb}。`, "ok");
  }
  if (FEAT_IDS.every((id) => g.feats[id]) && g.clearModal === null && !g.ending) {
    g.clearModal = "legend";
    pauseForInterrupt(g);
    pushNews(g, "覇業が揃った。半世界は、店の名前を覚えている。", "ok");
  }
}

export function enterEndless(state: GameState): GameState {
  const g = clone(state);
  const first = g.era !== "endless";
  g.era = "endless";
  g.clearModal = null;
  resumeSpeed(g);
  if (first) {
    g.warHeat = clamp(g.warHeat + 14, 0, 100);
    pushNews(g, "やりこみ開始。三十六日は序章だった。内乱が、店を本対象にする。", "warn");
  }
  return g;
}

export function retireRun(state: GameState): GameState {
  const g = clone(state);
  const id = g.clearModal === "legend" ? "legend" : (g.scenarioEnding ?? rankScenario(g));
  applyEnding(g, id);
  return g;
}

function emptySold(): Record<ProductId, number> {
  return {
    bento: 0,
    mpcan: 0,
    chicken: 0,
    onigiri: 0,
    oil: 0,
    salt: 0,
    lantern: 0,
    map: 0,
    wine: 0,
  };
}

function pushNews(g: GameState, text: string, tone: NewsTone = "muted") {
  g.newsId += 1;
  const item = { id: g.newsId, day: g.day, hour: g.hour, text, tone };
  g.news.unshift(item);
  if (g.news.length > MAX_NEWS) g.news.length = MAX_NEWS;
  if (!g.chronicle) g.chronicle = [];
  g.chronicle.push(item);
  if (g.chronicle.length > MAX_CHRONICLE) g.chronicle.splice(0, g.chronicle.length - MAX_CHRONICLE);
}

function addRep(g: GameState, id: FactionId, delta: number) {
  g.factionRep[id] = clamp(g.factionRep[id] + delta, 0, 100);
}

function addPower(g: GameState, id: FactionId, delta: number) {
  g.factionPower[id] = clamp(g.factionPower[id] + delta, 5, 100);
}

function addWarRep(g: GameState, id: WarlordId, delta: number) {
  g.warlordRep[id] = clamp(g.warlordRep[id] + delta, 0, 100);
}

function addWarPower(g: GameState, id: WarlordId, delta: number) {
  g.warlordPower[id] = clamp(g.warlordPower[id] + delta, 5, 100);
}

function growPatron(g: GameState, patronId: PatronId, rec: PatronMemory, fac: FactionId): boolean {
  const before = rec.level ?? 1;
  const after = patronLevelFromSpent(rec.spent, rec.visits);
  rec.level = after;
  if (after <= before) return false;
  const gained = after - before;
  addPower(g, fac, gained * 1.15);
  addRep(g, fac, gained * 0.55);
  for (const other of FACTION_IDS) {
    if (other === fac) continue;
    addPower(g, other, -gained * 0.12);
  }
  const kind = PATRONS[patronId];
  const who = rec.nickname ?? kind?.name ?? "常連";
  const rose = kind && isPenniless(kind.purse);
  if (rose && before < 3 && after >= 3) {
    pushNews(g, `${who}が成り上がった。見切りの列から、段がついた。`, "ok");
  } else if (rose && before < 5 && after >= 5) {
    pushNews(g, `${who}の財布が、もう無銭ではない。`, "ok");
  }
  const family = WARLORD_IDS.filter((w) => warKnown(g, w) && WARLORDS[w].family === fac);
  if (family.length) {
    const contracted = g.warContract && family.includes(g.warContract) ? g.warContract : null;
    const favored =
      contracted ??
      family.slice().sort((a, b) => {
        const da = g.dens[WARLORDS[a].den] * 10 + g.warlordRep[a];
        const db = g.dens[WARLORDS[b].den] * 10 + g.warlordRep[b];
        return db - da;
      })[0]!;
    for (const w of family) {
      if (w === favored) addWarPower(g, w, gained * 1.35);
      else addWarPower(g, w, -gained * 0.4);
    }
    if (after >= 3 && !(rose && before < 3)) {
      pushNews(
        g,
        `${who}が${after}段になった。${FACTIONS[fac].short}の胃袋が、${WARLORDS[favored].leader}側へ傾く。`,
        "ok",
      );
    }
  } else if (after >= 3 && !(rose && before < 3)) {
    pushNews(g, `${who}が${after}段になった。${FACTIONS[fac].short}の列が、少し厚い。`, "ok");
  }
  return true;
}

function familyRegularLevels(g: GameState, fac: FactionId): number {
  let sum = 0;
  for (const [id, m] of Object.entries(g.patrons)) {
    const kind = PATRONS[id as PatronId];
    if (!kind || kind.faction !== fac) continue;
    const lv = m.level ?? patronLevelFromSpent(m.spent, m.visits);
    if (lv >= 2) sum += lv - 1;
  }
  return sum;
}

function warKnown(g: GameState, id: WarlordId): boolean {
  if (id !== "revan") return true;
  return g.caveKnown && !g.caveSealed;
}

function contractFamily(g: GameState): FactionId | null {
  return g.warContract ? WARLORDS[g.warContract].family : null;
}

function hasStaff(g: GameState, id: StaffId): boolean {
  return g.staff.includes(id);
}

function dropHermit(g: GameState) {
  if (!g.staff.includes("hermit")) return;
  g.staff = g.staff.filter((x) => x !== "hermit");
}

function purgeCaveShelter(g: GameState) {
  dropHermit(g);
  if (g.warContract === "revan") g.warContract = null;
}

function sellPrice(g: GameState, id: ProductId): number {
  const base = PRODUCTS[id].price;
  return g.campaign === "sale" ? Math.round(base * 0.85) : base;
}

function orderCost(g: GameState, id: ProductId, qty: number): number {
  const unit = PRODUCTS[id].cost;
  const disc = hasStaff(g, "scribe") ? 0.9 : 1;
  return Math.round(unit * disc * qty);
}

function defense(g: GameState): number {
  return (
    g.facilities.golem * 0.22 +
    (hasStaff(g, "guard") ? 0.18 : 0) +
    g.factionRep.gabing / 400
  );
}

function attractedCount(g: GameState): number {
  return DEN_IDS.filter((id) => g.dens[id] > 0).length;
}

export function createInitialState(): GameState {
  const dens = Object.fromEntries(DEN_IDS.map((id) => [id, 0])) as Record<DenId, number>;
  dens.radaan = 1;
  const facilities = Object.fromEntries(
    Object.keys(FACILITIES).map((id) => [id, 0]),
  ) as Record<FacilityId, number>;
  const seeded = starterLayout();
  const g0: GameState = {
    version: SAVE_VERSION,
    phase: "intro",
    day: 1,
    hour: 7,
    speed: 0,
    heldSpeed: 1,
    gold: 540,
    storeHp: MAX_HP,
    emperor: 52,
    warHeat: 18,
    rng: (Math.floor(Math.random() * 0xffffff) ^ Date.now()) >>> 0 || 1,
    newsId: 1,
    visitSeq: 0,
    inventory: {
      bento: 0,
      mpcan: 5,
      chicken: 0,
      onigiri: 0,
      oil: 3,
      salt: 2,
      lantern: 0,
      map: 1,
      wine: 0,
    },
    scrap: { ...emptySold(), onigiri: 6, bento: 2 },
    facilities,
    staff: [],
    dens,
    factionRep: {
      gelum: 58,
      yokuga: 40,
      gabing: 42,
      kottou: 38,
      rinkou: 36,
      jumon: 44,
      cave: 34,
    },
    factionPower: {
      gelum: 28,
      yokuga: 30,
      gabing: 36,
      kottou: 26,
      rinkou: 34,
      jumon: 32,
      cave: 8,
    },
    warlordRep: {
      revan: 34,
      varos: 48,
      hoimu: 44,
      yamato: 40,
      tsukuyo: 38,
      kisera: 42,
      garyu: 40,
      kazer: 36,
      delark: 40,
      rokka: 38,
      gurea: 36,
    },
    warlordPower: {
      revan: 12,
      varos: 36,
      hoimu: 24,
      yamato: 22,
      tsukuyo: 18,
      kisera: 26,
      garyu: 22,
      kazer: 20,
      delark: 20,
      rokka: 22,
      gurea: 24,
    },
    warContract: null,
    campaign: null,
    campaignUntil: 0,
    goldToday: 0,
    guestsToday: 0,
    missedToday: 0,
    soldToday: emptySold(),
    goldHistory: [540],
    news: [
      {
        id: 1,
        day: 1,
        hour: 7,
        text: "灰都ラダーン。半世界24、開店。人族のゆうしゃがレジに立つ。半分を渡した日から、十一の旗が立った。",
        tone: "ok",
      },
    ],
    chronicle: [],
    shelfLogs: [],
    logSeq: 0,
    lastVisits: [],
    pendingEvent: null,
    ending: null,
    era: "scenario",
    scenarioEnding: null,
    clearModal: null,
    feats: emptyFeats(),
    peakGold: 540,
    tutorial: { ordered: false, attracted: false, openedMap: false, designed: false },
    caveKnown: false,
    caveSealed: false,
    layout: seeded.layout,
    layoutUid: seeded.layoutUid,
    patrons: {},
  };
  g0.chronicle = seedChronicle(g0.news);
  syncFacilities(g0);
  return g0;
}

export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<GameState>;
  if (typeof s.version !== "number") return null;
  const base = createInitialState();
  const merged: GameState = {
    ...base,
    ...s,
    version: SAVE_VERSION,
    inventory: { ...base.inventory, ...s.inventory },
    facilities: { ...base.facilities, ...s.facilities },
    dens: { ...base.dens, ...s.dens },
    factionRep: { ...base.factionRep, ...s.factionRep },
    factionPower: { ...base.factionPower, ...s.factionPower },
    warlordRep: { ...base.warlordRep, ...(s as { warlordRep?: Record<string, number> }).warlordRep },
    warlordPower: { ...base.warlordPower, ...(s as { warlordPower?: Record<string, number> }).warlordPower },
    soldToday: { ...base.soldToday, ...s.soldToday },
    scrap: { ...base.scrap, ...(s as { scrap?: Record<string, number> }).scrap },
    tutorial: { ...base.tutorial, ...s.tutorial },
    staff: Array.isArray(s.staff) ? s.staff : base.staff,
    news: Array.isArray(s.news) ? s.news : base.news,
    chronicle: Array.isArray((s as { chronicle?: NewsItem[] }).chronicle)
      ? (s as { chronicle: NewsItem[] }).chronicle
      : seedChronicle(Array.isArray(s.news) ? s.news : base.news),
    shelfLogs: Array.isArray((s as { shelfLogs?: GameState["shelfLogs"] }).shelfLogs)
      ? (s as { shelfLogs: GameState["shelfLogs"] }).shelfLogs
      : [],
    logSeq: typeof (s as { logSeq?: number }).logSeq === "number" ? (s as { logSeq: number }).logSeq : 0,
    lastVisits: Array.isArray(s.lastVisits) ? s.lastVisits : [],
    patrons:
      s.patrons && typeof s.patrons === "object" && !Array.isArray(s.patrons)
        ? Object.fromEntries(
            Object.entries(s.patrons).map(([id, m]) => [
              id,
              { ...m, level: m.level ?? patronLevelFromSpent(m.spent ?? 0, m.visits ?? 0) },
            ]),
          )
        : {},
    goldHistory: Array.isArray(s.goldHistory) ? s.goldHistory : base.goldHistory,
    pendingEvent: s.pendingEvent ?? null,
    ending: s.ending ?? null,
    era: s.era === "endless" ? "endless" : "scenario",
    scenarioEnding: s.scenarioEnding ?? null,
    clearModal: s.clearModal === "scenario" || s.clearModal === "legend" ? s.clearModal : null,
    feats: { ...emptyFeats(), ...(s as { feats?: Partial<Record<FeatId, boolean>> }).feats },
    peakGold: typeof s.peakGold === "number" ? s.peakGold : typeof s.gold === "number" ? s.gold : base.peakGold,
    caveKnown: Boolean(s.caveKnown),
    caveSealed: Boolean(s.caveSealed),
    heldSpeed: s.heldSpeed === 3 || s.heldSpeed === 5 || s.heldSpeed === 10 || s.heldSpeed === 20 || s.heldSpeed === 1 ? s.heldSpeed : 1,
    phase: s.phase === "playing" || s.phase === "ending" ? s.phase : "playing",
  };
  const oldMap: Record<string, WarlordId> = {
    cave: "revan",
    gelum: "hoimu",
    yokuga: "garyu",
    gabing: "gurea",
    kottou: "delark",
    rinkou: "kisera",
    jumon: "varos",
  };
  if (merged.warContract && !WARLORD_IDS.includes(merged.warContract)) {
    merged.warContract = oldMap[merged.warContract] ?? null;
  }
  if (!Array.isArray(s.layout) || s.layout.length === 0) {
    const seeded = layoutFromFacilities(merged);
    merged.layout = seeded.layout;
    merged.layoutUid = seeded.layoutUid;
  }
  syncFacilities(merged);
  hydrateGondolas(merged);
  if (typeof s.version === "number" && s.version < 6) pourWarehouseToShelves(merged);
  return merged;
}

function trafficForHour(g: GameState): number {
  const band = timeBand(g.hour);
  let t = 0.15;
  for (const id of DEN_IDS) {
    const lv = g.dens[id];
    if (lv <= 0) continue;
    if (id === "hollow" && (!g.caveKnown || g.caveSealed)) continue;
    const den = DENS[id];
    const fac = den.faction;
    if (g.factionRep[fac] < 12) continue;
    let m = den.pop * lv * 0.016;
    m *= FACTIONS[fac].bands[band];
    m *= 0.55 + g.factionRep[fac] / 110;
    if (den.dist >= 2 && !g.facilities.delivery && !hasStaff(g, "courier")) m *= 0.62;
    if ((band === "night" || band === "late") && g.facilities.lighting === 0) m *= 0.55;
    else m *= 1 + g.facilities.lighting * 0.12;
    if (fac === "rinkou" && !g.facilities.wyvern) m *= 0.45;
    if (fac === "kottou" && hasStaff(g, "night") && (band === "night" || band === "late")) m *= 1.25;
    if (fac === "gelum" && hasStaff(g, "clerk")) m *= 1.1;
    t += m;
  }
  if (hasStaff(g, "hermit") && g.caveKnown && !g.caveSealed) {
    t += 0.22 * FACTIONS.cave.bands[band];
  }
  if (g.campaign === "leaflet") t *= 1.42;
  if (g.campaign === "sale") t *= 1.28;
  if (g.era === "endless") t *= 1 + Math.min(0.85, endlessAge(g) * 0.02);
  const shelves = g.layout.filter((f) => f.kind === "shelf" || f.kind === "hotcase").length;
  t *= 1 + Math.min(0.5, shelves * 0.04);
  if (!hasRegisterPath(g)) t *= 0.45;
  t *= 1 + g.facilities.register * 0.06;
  return t;
}

function pickFaction(g: GameState): FactionId {
  const band = timeBand(g.hour);
  const weights: { id: FactionId; w: number }[] = [];
  for (const id of FACTION_IDS) {
    if (id === "cave" && (!g.caveKnown || g.caveSealed)) continue;
    if (id === "cave" && g.dens.hollow <= 0 && !hasStaff(g, "hermit")) continue;
    let w = 0.15;
    for (const denId of DEN_IDS) {
      if (g.dens[denId] <= 0) continue;
      if (DENS[denId].faction !== id) continue;
      w += DENS[denId].pop * g.dens[denId];
    }
    w *= FACTIONS[id].bands[band];
    w *= 0.4 + g.factionRep[id] / 100;
    if (g.factionRep[id] < 12) w *= 0.05;
    weights.push({ id, w: Math.max(0.01, w) });
  }
  const sum = weights.reduce((s, x) => s + x.w, 0);
  let r = rand(g) * sum;
  for (const x of weights) {
    r -= x.w;
    if (r <= 0) return x.id;
  }
  return "gelum";
}

function pickPatron(g: GameState, fac: FactionId): PatronId {
  const list = PATRONS_BY_FACTION[fac];
  const stamp = nowStamp(g.day, g.hour);
  const weights = list.map((p) => {
    let w = 1;
    const m = g.patrons[p.id];
    if (m?.nickname) {
      const busy = g.lastVisits.some(
        (v) => !v.left && (v.patron === p.id || (m.nickname && v.nickname === m.nickname)),
      );
      if (busy) w = 0;
    }
    if (m) {
      const ago = stamp - nowStamp(m.lastDay, m.lastHour);
      const lv = m.level ?? patronLevelFromSpent(m.spent, m.visits);
      if (ago <= 1) w *= 0.08;
      else if (ago < 8) w *= 0.45;
      else if (ago < 36) w *= 1.35;
      else w *= 1.15 + Math.min(0.8, m.visits * 0.06);
      w *= 1 + (lv - 1) * 0.14;
      if (isPenniless(p.purse) && lv >= 2) w *= 1.3;
    }
    return { id: p.id, w };
  });
  const sum = weights.reduce((s, x) => s + x.w, 0);
  let r = rand(g) * sum;
  for (const x of weights) {
    r -= x.w;
    if (r <= 0) return x.id;
  }
  return list[0]!.id;
}

function pickWant(g: GameState, fac: FactionId, favorite?: ProductId, kindPurse = 40, lv = 1): ProductId {
  const opts: { id: ProductId; w: number }[] = [];
  const rising = isPenniless(kindPurse) && lv >= 3;
  for (const id of PRODUCT_IDS) {
    const p = PRODUCTS[id];
    if (p.needs && g.facilities[p.needs] <= 0) continue;
    let w = p.affinity[fac];
    if (favorite === id) w *= rising ? 1.4 : 2.4;
    if (faceStock(g, id) <= 0) w *= 0.15;
    else w *= 1.1;
    const shown = countProductShelf(g.layout, id);
    if (shown <= 0) w *= 0.35;
    else w *= 1 + shown * 0.12;
    if (id === "wine" && hasStaff(g, "host")) w *= 1.45;
    if (id === "chicken") w *= 1.15;
    if (rising) {
      if (favorite === id && p.price <= 12) w *= 0.55;
      if (id === "bento" || id === "chicken" || id === "mpcan") w *= 1.1 + (lv - 2) * 0.18;
      if (lv >= 5 && (id === "wine" || id === "oil" || id === "map")) w *= 1.55;
    }
    opts.push({ id, w });
  }
  const sum = opts.reduce((s, x) => s + x.w, 0);
  let r = rand(g) * sum;
  for (const x of opts) {
    r -= x.w;
    if (r <= 0) return x.id;
  }
  return favorite && faceStock(g, favorite) > 0 ? favorite : "onigiri";
}

function substitute(g: GameState, fac: FactionId, avoid: ProductId): ProductId | null {
  let best: ProductId | null = null;
  let bestW = 0;
  for (const id of PRODUCT_IDS) {
    if (id === avoid) continue;
    if (faceStock(g, id) <= 0) continue;
    const p = PRODUCTS[id];
    if (p.needs && g.facilities[p.needs] <= 0) continue;
    const w = p.affinity[fac];
    if (w > bestW) {
      bestW = w;
      best = id;
    }
  }
  return bestW >= 0.5 ? best : null;
}

function beginVisit(g: GameState, fac: FactionId, want: ProductId, patronId: PatronId): FloorVisit {
  g.visitSeq += 1;
  const kind = PATRONS[patronId] ?? PATRONS_BY_FACTION[fac][0]!;
  const mem = g.patrons[patronId];
  const mul = mem?.nickname && mem.purseMul ? mem.purseMul : 1;
  const lv = mem?.level ?? patronLevelFromSpent(mem?.spent ?? 0, mem?.visits ?? 0);
  const mid = purseAtLevel(kind.purse, lv);
  const swing = Math.max(1, Math.ceil(mid * 0.12));
  const purse = Math.max(
    scrapPrice("onigiri"),
    Math.round((mid + randInt(g, -swing, swing)) * mul),
  );
  const hunger =
    kind.binge + (lv - 1) * 0.04 + (isPenniless(kind.purse) && lv >= 4 ? 0.2 : 0);
  return {
    seq: g.visitSeq,
    faction: fac,
    want,
    mood: "happy",
    patron: patronId,
    bought: 0,
    purseLeft: purse,
    binge: hunger >= 0.45 && rand(g) < Math.min(0.95, hunger),
    prevDay: mem?.lastDay,
    prevHour: mem?.lastHour,
    visitCount: mem?.visits ?? 0,
    spentTotal: mem?.spent ?? 0,
    level: lv,
    picked: false,
    paid: false,
    nickname: mem?.nickname,
    purseMul: mul > 1 ? mul : undefined,
  };
}

export function pickAtShelf(state: GameState, seq: number, shelfUid?: number): GameState {
  const g = clone(state);
  if (!g.scrap) g.scrap = emptySold();
  const v = g.lastVisits.find((x) => x.seq === seq);
  if (!v || v.picked) return g;
  v.picked = true;
  const fac = v.faction;
  const patronId = v.patron;
  const kind = patronId ? PATRONS[patronId] : undefined;
  let purse = v.purseLeft ?? 0;
  const startPurse = purse;
  let item = v.want;
  if (faceStock(g, item) <= 0) {
    const sub = substitute(g, fac, item);
    if (sub) item = sub;
  }
  const who =
    v.nickname ??
    (v.named ? WARLORDS[v.named].leader : undefined) ??
    (patronId && PATRONS[patronId] ? PATRONS[patronId].name : FACTIONS[fac].short);

  const grab = (id: ProductId, markdown: boolean): number => {
    const price = markdown ? scrapPrice(id) : sellPrice(g, id);
    if (price > purse) return 0;
    if (markdown) {
      if ((g.scrap[id] ?? 0) <= 0) return 0;
      g.scrap[id] -= 1;
    } else {
      if (faceStock(g, id) <= 0) return 0;
      takeProduct(g, id, 1, "sale", who, shelfUid);
    }
    purse -= price;
    return price;
  };

  let bill = grab(item, false);
  let bought = bill > 0 ? 1 : 0;
  let markdown = false;
  if (bought <= 0) {
    bill = grab(item, true);
    if (bill > 0) {
      bought = 1;
      markdown = true;
    } else {
      const cheap = PRODUCT_IDS.filter((id) => (g.scrap[id] ?? 0) > 0).sort(
        (a, b) => scrapPrice(a) - scrapPrice(b) || PRODUCTS[b].affinity[fac] - PRODUCTS[a].affinity[fac],
      );
      for (const id of cheap) {
        const pay = grab(id, true);
        if (pay <= 0) continue;
        item = id;
        bill = pay;
        bought = 1;
        markdown = true;
        break;
      }
    }
  }
  if (bought && v.binge && !markdown) {
    const extra = 1 + randInt(g, 0, 3);
    for (let i = 0; i < extra; i++) {
      const nxt = faceStock(g, item) > 0 ? item : kind?.favorite ?? item;
      const pay = grab(nxt, false);
      if (pay <= 0) break;
      bill += pay;
      bought += 1;
    }
  } else if (bought && markdown && (g.scrap[item] ?? 0) > 0 && purse >= scrapPrice(item)) {
    const pay = grab(item, true);
    if (pay > 0) {
      bill += pay;
      bought += 1;
    }
  }
  v.got = bought > 0 ? item : v.want;
  v.bought = bought;
  v.bill = bill;
  v.purseLeft = purse;
  v.scrap = markdown || undefined;
  if (bought <= 0) {
    v.mood = "empty";
    v.broke = startPurse < sellPrice(g, v.want);
    g.missedToday += 1;
  }
  return g;
}

export function payAtRegister(state: GameState, seq: number): GameState {
  const g = clone(state);
  const v = g.lastVisits.find((x) => x.seq === seq);
  if (!v || v.paid) return g;
  if (!v.picked) return g;
  v.paid = true;
  const fac = v.faction;
  const item = v.got ?? v.want;
  const bought = v.bought ?? 0;
  let spent = v.bill ?? 0;
  if (bought > 0 && spent > 0) {
    g.gold += spent;
    g.goldToday += spent;
    g.soldToday[item] = (g.soldToday[item] ?? 0) + bought;
    addRep(g, fac, item === v.want ? 0.35 * bought : 0.1);
    if (item === "oil" || item === "salt" || item === "map") {
      addPower(g, fac, 0.45 * bought);
      g.warHeat = clamp(g.warHeat + 0.35 * bought, 0, 100);
      if (contractFamily(g) === fac && g.warContract) addWarPower(g, g.warContract, 0.55 * bought);
    }
    if (item === "wine") {
      v.mood = "rich";
      g.emperor = clamp(g.emperor + 0.6, 0, 100);
    }
    if (item === "chicken") g.emperor = clamp(g.emperor + 0.2, 0, 100);
    if (g.facilities.atm && (fac === "rinkou" || item === "wine") && rand(g) < 0.45) {
      const tip = Math.min(12, v.purseLeft ?? 0);
      v.purseLeft = (v.purseLeft ?? 0) - tip;
      g.gold += tip;
      g.goldToday += tip;
      spent += tip;
    }
  } else {
    addRep(g, fac, -3);
    g.emperor = clamp(g.emperor - 0.4, 0, 100);
  }

  const namedOdds = g.era === "endless" ? 0.08 : g.day >= 4 ? 0.045 : 0.02;
  if (bought > 0 && rand(g) < namedOdds) {
    const cands = WARLORD_IDS.filter(
      (w) => warKnown(g, w) && WARLORDS[w].family === fac && g.dens[WARLORDS[w].den] > 0,
    );
    if (cands.length) {
      v.named = pick(g, cands);
      const extra = 18 + randInt(g, 8, 28);
      g.gold += extra;
      g.goldToday += extra;
      spent += extra;
      addWarRep(g, v.named, 4);
      addWarPower(g, v.named, 1.2);
      v.mood = "rich";
      pushNews(g, `${WARLORDS[v.named].leader}がレジに立った。ネームドの会計。`, "ok");
    }
  }

  if (bought > 0) {
    g.guestsToday += 1;
    if (v.binge && bought >= 3) v.mood = "rich";
    else if (spent >= 80) v.mood = "rich";
    else if (v.mood !== "rich") v.mood = "happy";
  }

  if (v.patron) {
    const rec = g.patrons[v.patron] ?? { lastDay: g.day, lastHour: g.hour, visits: 0, spent: 0, level: 1 };
    rec.lastDay = g.day;
    rec.lastHour = g.hour;
    rec.visits += 1;
    rec.level = rec.level ?? patronLevelFromSpent(rec.spent, rec.visits);
    rec.spent += spent;
    const grew = growPatron(g, v.patron, rec, fac);
    g.patrons[v.patron] = rec;
    v.visitCount = rec.visits;
    v.spentTotal = rec.spent;
    v.level = rec.level;
    if (grew) v.leveledTo = rec.level;
  }
  v.bill = spent;
  if (g.gold > g.peakGold) g.peakGold = g.gold;
  return g;
}

export function namedCount(g: GameState): number {
  return Object.values(g.patrons).filter((m) => m.nickname).length;
}

export function trueNameCost(g: GameState, patronId: PatronId): number {
  if (g.patrons[patronId]?.nickname) return 40;
  const n = namedCount(g);
  return 80 * (n + 1) * (n + 1);
}

export function namePatron(state: GameState, patronId: PatronId, raw: string): ActionResult {
  const g = clone(state);
  const kind = PATRONS[patronId];
  if (!kind) return { ok: false, error: "その客は、もういない。" };
  const name = raw.replace(/\s+/g, "").slice(0, 8);
  if (!name) return { ok: false, error: "真名が空だ。" };
  for (const [id, m] of Object.entries(g.patrons)) {
    if (id !== patronId && m.nickname === name) return { ok: false, error: "その真名は、すでに店にいる。" };
  }
  const rec = g.patrons[patronId] ?? { lastDay: g.day, lastHour: g.hour, visits: 0, spent: 0 };
  const renaming = Boolean(rec.nickname);
  if (!renaming && namedCount(g) >= MAX_TRUE_NAMES) {
    return { ok: false, error: `真名は${MAX_TRUE_NAMES}人まで。名札の塩が足りない。` };
  }
  const cost = trueNameCost(g, patronId);
  if (g.gold < cost) return { ok: false, error: `名札代が足りない（${cost}G）。` };
  g.gold -= cost;
  rec.nickname = name;
  if (!renaming) rec.purseMul = randInt(g, 3, 10);
  rec.namedDay = g.day;
  rec.level = rec.level ?? patronLevelFromSpent(rec.spent, rec.visits);
  g.patrons[patronId] = rec;
  for (const v of g.lastVisits) {
    if (v.patron === patronId && !v.left) v.nickname = name;
  }
  pushNews(g, `真名「${name}」を${kind.name}に刻んだ。次から財布が${rec.purseMul}倍。`, "ok");
  return { ok: true, state: g, message: `${name}。次回来店から所持金が${rec.purseMul}倍。` };
}

export function guestLeave(state: GameState, seq: number): GameState {
  const g = clone(state);
  const v = g.lastVisits.find((x) => x.seq === seq);
  if (v) v.left = true;
  return g;
}

function maybeRaid(g: GameState) {
  const band = timeBand(g.hour);
  if (band !== "night" && band !== "late") return;
  if (g.day < 3) return;
  let heat = g.warHeat / 100;
  let risk = 0;
  for (const id of DEN_IDS) {
    if (g.dens[id] > 0) risk = Math.max(risk, DENS[id].raid);
  }
  const p = heat * risk * (0.55 - defense(g)) * (g.era === "endless" ? 1 + Math.min(1.4, endlessAge(g) * 0.035) : 1);
  if (rand(g) > Math.max(0.02, p)) return;
  const dmg =
    randInt(g, 14, 22) +
    Math.floor(g.warHeat / 10) -
    Math.floor(defense(g) * 18) +
    (g.era === "endless" ? Math.floor(endlessAge(g) / 7) : 0);
  const hurt = clamp(dmg, 8, 42);
  g.storeHp = clamp(g.storeHp - hurt, 0, MAX_HP);
  for (const id of PRODUCT_IDS) {
    const steal = Math.floor(onHand(g, id) * (0.08 + rand(g) * 0.12));
    takeProduct(g, id, steal, "raid");
  }
  g.warHeat = clamp(g.warHeat + 6, 0, 100);
  g.emperor = clamp(g.emperor - 4, 0, 100);
  pushNews(g, `襲撃。店のHP ${hurt} 減。棚が荒らされた。`, "danger");
}

function endOfDay(g: GameState) {
  let marked = 0;
  let dumped = 0;
  if (!g.scrap) g.scrap = emptySold();
  for (const id of PRODUCT_IDS) {
    const frac = PRODUCTS[id].perish;
    if (frac <= 0) continue;
    const w = Math.floor(onHand(g, id) * frac);
    if (w <= 0) continue;
    takeProduct(g, id, w, "waste");
    const room = Math.max(0, MAX_SCRAP - (g.scrap[id] ?? 0));
    const keep = Math.min(w, room);
    g.scrap[id] = (g.scrap[id] ?? 0) + keep;
    marked += keep;
    dumped += w - keep;
  }
  let wages = 0;
  for (const s of g.staff) wages += STAFF[s].wage;
  g.gold -= wages;
  g.goldHistory.push(g.gold);
  if (g.goldHistory.length > 16) g.goldHistory.shift();

  for (const id of FACTION_IDS) {
    if (id === "cave" && g.caveSealed) {
      addPower(g, id, -1.5);
      continue;
    }
    addPower(g, id, 0.2);
    if (contractFamily(g) === id) addPower(g, id, 1.4);
    else addPower(g, id, -0.15);
    const fed = familyRegularLevels(g, id);
    if (fed > 0) addPower(g, id, Math.min(1.6, fed * 0.08));
  }
  for (const id of WARLORD_IDS) {
    if (!warKnown(g, id)) {
      addWarPower(g, id, -0.4);
      continue;
    }
    const held = g.dens[WARLORDS[id].den];
    addWarPower(g, id, 0.15 + held * 0.35);
    if (g.warContract === id) addWarPower(g, id, 1.6);
    else addWarPower(g, id, -0.2);
  }
  if (g.warContract) g.warHeat = clamp(g.warHeat + 3, 0, 100);
  else g.warHeat = clamp(g.warHeat - 3.5, 0, 100);

  g.emperor = clamp(g.emperor - 0.8 - (g.era === "endless" ? 0.45 : 0), 0, 100);
  if (g.soldToday.wine + g.soldToday.chicken >= 4) g.emperor = clamp(g.emperor + 3, 0, 100);
  if (g.gold > g.peakGold) g.peakGold = g.gold;

  const tone: NewsTone = g.goldToday >= 200 ? "ok" : g.missedToday > 8 ? "warn" : "muted";
  pushNews(
    g,
    `${g.day - 1}日目の締め。売上 ${g.goldToday}G / 客 ${g.guestsToday} / 欠品 ${g.missedToday}${wages ? ` / 給与 ${wages}G` : ""}${marked ? ` / 見切り+${marked}` : ""}${dumped ? ` / 廃棄 ${dumped}` : ""}。`,
    tone,
  );

  g.goldToday = 0;
  g.guestsToday = 0;
  g.missedToday = 0;
  g.soldToday = emptySold();
}

function pauseForInterrupt(g: GameState) {
  if (g.speed > 0) g.heldSpeed = g.speed;
  g.speed = 0;
}

function resumeSpeed(g: GameState) {
  const back = g.heldSpeed;
  g.speed = back === 3 || back === 5 || back === 10 || back === 20 || back === 1 ? back : 1;
}

function checkEnding(g: GameState): EndingId | null {
  if (g.storeHp <= 0) return "burned";
  if (g.gold < 0) return "broke";
  if (g.emperor <= 0) return "audit";
  return null;
}

function applyEnding(g: GameState, id: EndingId) {
  g.ending = id;
  g.phase = "ending";
  g.speed = 0;
  g.pendingEvent = null;
  g.clearModal = null;
  pushNews(g, ENDINGS[id].kicker, ENDINGS[id].win ? "ok" : "danger");
}

function civilWarClash(g: GameState) {
  if (g.day < 3) return;
  const hours = g.era === "endless" ? [6, 12, 18, 21] : [12, 18];
  if (!hours.includes(g.hour)) return;
  const chance = g.era === "endless" ? 0.82 : 0.7;
  if (rand(g) > chance) return;
  const live = WARLORD_IDS.filter((w) => warKnown(g, w) && g.warlordPower[w] >= 16);
  if (live.length < 2) return;
  const a = pick(g, live);
  const rest = live.filter((x) => x !== a);
  const b = pick(g, rest);
  const score = (w: WarlordId) => {
    const family = WARLORDS[w].family;
    const dens = g.dens[WARLORDS[w].den];
    const kin = WARLORD_IDS.filter((x) => warKnown(g, x) && WARLORDS[x].family === family);
    const kinDens = kin.reduce((s, x) => s + g.dens[WARLORDS[x].den], 0);
    const share = dens / Math.max(1, kinDens);
    return (
      g.warlordPower[w] +
      dens * 9 +
      (g.warContract === w ? 14 : 0) +
      familyRegularLevels(g, family) * 0.45 * (0.35 + share) +
      rand(g) * 8
    );
  };
  const winner = score(a) >= score(b) ? a : b;
  const loser = winner === a ? b : a;
  addWarPower(g, winner, g.era === "endless" ? 7 : 5);
  addWarPower(g, loser, g.era === "endless" ? -8 : -6);
  addWarRep(g, winner, 3);
  addWarRep(g, loser, -4);
  g.warHeat = clamp(g.warHeat + 7, 0, 100);
  const kin = WARLORDS[winner].family === WARLORDS[loser].family;
  pushNews(
    g,
    `${kin ? "同種相撃。" : ""}${WARLORDS[winner].leader}が${WARLORDS[loser].leader}を破った。${WARLORDS[winner].name}が伸びる。`,
    kin ? "danger" : "warn",
  );
  if (g.warContract === loser) {
    g.storeHp = clamp(g.storeHp - 6, 0, MAX_HP);
    pushNews(g, "契約した旗が折れた。店に余波が来た。", "danger");
  } else if (g.warContract === winner) {
    g.gold += 55;
    pushNews(g, "兵站先が勝った。御用達の金が落ちた。", "ok");
  }
}

function maybeEvent(g: GameState) {
  if (g.pendingEvent || g.clearModal) return;
  if (g.hour === 2 && g.day === 2 && !g.caveKnown && !g.caveSealed) {
    pushNews(g, "深夜、西の断崖で石が落ちる音。人間はダンジョンにいる。まだ喉がある。", "muted");
  }
  if (g.hour === 21 && g.day === 3 && !g.caveKnown && !g.caveSealed) {
    pushNews(g, "ジェルムが噂する。ダンジョンに、牙でも翼でもない手が灯を欲しがっている。", "muted");
  }
  const auditDays = [7, 14, 21, 28];
  if (g.hour === 8 && auditDays.includes(g.day)) {
    g.pendingEvent = auditEvent(g);
    pauseForInterrupt(g);
    return;
  }
  if (g.hour === 9 && g.day >= 4 && !g.caveKnown && !g.caveSealed) {
    g.pendingEvent = caveFootsteps();
    pauseForInterrupt(g);
    return;
  }
  if (
    g.hour === 21 &&
    g.day >= 9 &&
    g.caveKnown &&
    !g.caveSealed &&
    g.dens.hollow >= 1 &&
    rand(g) < 0.38
  ) {
    g.pendingEvent = caveHunt();
    pauseForInterrupt(g);
    return;
  }
  if (g.hour !== 9) return;
  if (g.day < 3) return;
  if (rand(g) > 0.42) return;
  const ev = rollEvent(g);
  if (!ev) return;
  g.pendingEvent = ev;
  pauseForInterrupt(g);
}

function auditEvent(g: GameState): PendingEvent {
  const ok = g.emperor >= 40;
  return {
    id: "audit",
    title: "片目",
    body: ok
      ? `人族のゆうしゃの店は、まだ黙認されている。機嫌 ${Math.round(g.emperor)}。沈黙を買うか、棚を見せるか。`
      : `りゅうおうの片目が、かつての刃を測っている。機嫌 ${Math.round(g.emperor)}。弁明の余地は薄い。`,
    portrait: "emperor",
    choices: [
      { id: "tribute", label: "沈黙を買う（220G）", hint: "部下の礼ではない" },
      { id: "show", label: "棚を開けて見せる", hint: "在庫と売上で誤魔化し、剣は見せない" },
      { id: "bow", label: "目を逸らす", hint: "安く、危うい" },
    ],
  };
}

function caveFootsteps(): PendingEvent {
  return {
    id: "cavefoot",
    title: "ダンジョンの足音",
    body: "西の断崖から、国家ではないものが来た。人間だ。ダンジョンに逃げ込んだ者たち。塩むすびを求め、灯を恐れ、りゅうおうの名を囁く。",
    portrait: "cave",
    choices: [
      { id: "lamp", label: "夜行灯を渡す", hint: "人間を客にする。りゅうおうの機嫌は落ちる" },
      { id: "pass", label: "黙って通す", hint: "ダンジョンを知る。まだ誘致はしない" },
      { id: "report", label: "りゅうおうに注進する", hint: "黙認は厚い。同胞は消える" },
    ],
  };
}

function caveHunt(): PendingEvent {
  return {
    id: "cavehunt",
    title: "ダンジョン狩り",
    body: "牙兵が西の断崖の匂いを追っている。ダンジョンの人間は客だ。兵站か、隠れ家か。",
    portrait: "gabing",
    choices: [
      { id: "tell", label: "道を教える", hint: "人間は消える。牙兵とりゅうおうは喜ぶ" },
      { id: "lie", label: "嘘の地図を渡す", hint: "巣穴地図が要る。人間はもう一晩生きる" },
      { id: "food", label: "塩むすびで時間を買う", hint: "狩りは延びる。決着はつかない" },
    ],
  };
}

function rollEvent(g: GameState): PendingEvent | null {
  const pool: { w: number; make: () => PendingEvent }[] = [
    {
      w: 1.2,
      make: () => ({
        id: "march",
        title: "牙兵の大行軍",
        body: "岩脈から牙の列が見える。胃と刃が同時に欲しがっている。兵站を担えば、荒野が熱を持つ。",
        portrait: "gabing",
        choices: [
          { id: "supply", label: "刃油を卸す", hint: "在庫の刃油を半分渡す。牙兵が伸びる" },
          { id: "food", label: "弁当を積む", hint: "食料を渡し、中立を装う" },
          { id: "shut", label: "シャッターを下ろす", hint: "安全。不興。" },
        ],
      }),
    },
    {
      w: 1,
      make: () => ({
        id: "fog",
        title: "翼牙の霧夜",
        body: "港から霧が這い、缶を求める羽音が蛍光にぶつかる。灯を足せば客になる。足さねば盗賊になる。",
        portrait: "yokuga",
        choices: [
          { id: "open", label: "深夜営業を強める", hint: "来客増。MP缶が飛ぶ" },
          { id: "guard", label: "牙兵警備に任せる", hint: "守り優先" },
          { id: "ignore", label: "霧を無視する", hint: "安い。危険。" },
        ],
      }),
    },
    {
      w: 0.9,
      make: () => ({
        id: "skirmish",
        title: "荒野の衝突",
        body: "中央荒野で二つの旗が噛み合った。ネームドの敗走は店の前を通る。勝者は油を催促する。",
        portrait: "gabing",
        choices: [
          { id: "refugees", label: "敗走を客にする", hint: "一時的な来客。戦争熱は上がる" },
          { id: "winner", label: "勝者に卸す", hint: "兵站契約に近い" },
          { id: "neutral", label: "水だけ出す", hint: "熱を冷ます" },
        ],
      }),
    },
    {
      w: 0.7,
      make: () => ({
        id: "goldenslime",
        title: "金眼のジェルム",
        body: "灰都の路地から、瞳が金貨のジェルムが転がり込んだ。買えば吉。逃がしても吉、と言い切れる者はいない。",
        portrait: "gelum",
        choices: [
          { id: "serve", label: "塩むすびを最高の棚から出す", hint: "金と評判" },
          { id: "keep", label: "看板に据える", hint: "ジェルム誘致" },
          { id: "sell", label: "鱗侯に高値で譲る", hint: "金。ジェルムは怒るかも" },
        ],
      }),
    },
    {
      w: 0.8,
      make: () => ({
        id: "ban",
        title: "呪書禁令",
        body: "塔が禁令を降ろした。呪い塩と巣穴地図が、しばらく灰色になる。隠して売るか、従うか。",
        portrait: "jumon",
        choices: [
          { id: "hide", label: "裏棚で売る", hint: "利益。りゅうおうの機嫌は落ちる" },
          { id: "obey", label: "禁令に従う", hint: "該当在庫を封ずる" },
          { id: "bribe", label: "書記に鱗酒を握らせる", hint: "在庫の鱗酒が必要" },
        ],
      }),
    },
    {
      w: 0.6,
      make: () => ({
        id: "rival",
        title: "対抗店の灯",
        body: "峠の向こうに、赤い蛍光が点いた。模倣店。値を崩すか、巣穴を先に取るか。",
        choices: [
          { id: "price", label: "特売で潰す", hint: "キャンペーン即時" },
          { id: "grab", label: "最寄りの未誘致を急ぐ", hint: "金で巣穴を買う" },
          { id: "wait", label: "無視する", hint: "来客が少し減る" },
        ],
      }),
    },
    {
      w: 0.5,
      make: () => ({
        id: "theft",
        title: "棚から消えた",
        body: "深夜、塩むすびの山が減っている。骨灯の仕業か、ただの飢えか。",
        portrait: "kottou",
        choices: [
          { id: "forgive", label: "飢えた者の分とする", hint: "骨灯の評判" },
          { id: "lock", label: "倉庫を増やす宣言", hint: "次の拡張が少し安い" },
          { id: "hunt", label: "追い立てる", hint: "在庫は守れる。不興。" },
        ],
      }),
    },
    {
      w: 0.55,
      make: () => ({
        id: "patrol",
        title: "片目の巡幸",
        body: "空が重く、鱗が雲を割る。かつての宿敵が、レジの灯を一目見るために降りる。棚が貧すれば、黙認は揺れる。",
        portrait: "emperor",
        choices: [
          { id: "feast", label: "チキンと鱗酒を並べる", hint: "在庫が要る" },
          { id: "gold", label: "金貨を積む（180G）", hint: "無難" },
          { id: "empty", label: "空の棚を晒す", hint: "最悪" },
        ],
      }),
    },
    {
      w: g.caveKnown || g.caveSealed ? 0 : 0.85,
      make: () => caveFootsteps(),
    },
    {
      w: g.era === "endless" ? 0.9 : 0,
      make: () => ({
        id: "secondwar",
        title: "第二の内乱",
        body: "序章が閉じた夜、十一の旗が同時に動いた。兵站を選ぶな、と誰かが言う。選ばねば、すべてが店の前で噛み合う。",
        portrait: "gabing",
        choices: [
          { id: "pick", label: "契約中の旗に全卸し", hint: "そのネームドが跳ねる。他は怒る" },
          { id: "open", label: "全旗に安く売る", hint: "熱は下がる。利益も薄い" },
          { id: "shut", label: "三日、シャッター", hint: "客は減る。店は残る" },
        ],
      }),
    },
    {
      w: g.era === "endless" ? 0.7 : 0,
      make: () => ({
        id: "eyequiz",
        title: "りゅうおうの問い",
        body: "片目が、レジの奥を見る。人族のゆうしゃよ、半世界は誰の胃か。答えを間違えれば、黙認は薄れる。",
        portrait: "emperor",
        choices: [
          { id: "mine", label: "店の胃だ、と答える", hint: "傲慢。金があれば許される" },
          { id: "yours", label: "りゅうおうの胃だ、と答える", hint: "機嫌は上がる。魔物は疑う" },
          { id: "none", label: "誰の胃でもない", hint: "中立。熱も機嫌も動かない" },
        ],
      }),
    },
  ];
  const live = pool.filter((x) => x.w > 0);
  const sum = live.reduce((s, x) => s + x.w, 0);
  let r = rand(g) * sum;
  for (const x of live) {
    r -= x.w;
    if (r <= 0) return x.make();
  }
  return live[0]!.make();
}

export function applyEventChoice(state: GameState, choice: string): GameState {
  const g = clone(state);
  const ev = g.pendingEvent;
  g.pendingEvent = null;
  if (!ev) return g;
  const id = ev.id;
  if (id === "audit") {
    if (choice === "tribute") {
      if (g.gold < 220) {
        g.emperor = clamp(g.emperor - 10, 0, 100);
        pushNews(g, "沈黙を買う金がない。りゅうおうの目が細くなる。", "danger");
      } else {
        g.gold -= 220;
        g.emperor = clamp(g.emperor + 16, 0, 100);
        addRep(g, "rinkou", 6);
        pushNews(g, "金貨は受理された。部下の礼ではない。黙認は続く。", "ok");
      }
    } else if (choice === "show") {
      const wealth = g.gold + totalOnHand(g) * 8;
      if (wealth > 1800 && g.emperor >= 30) {
        g.emperor = clamp(g.emperor + 6, 0, 100);
        pushNews(g, "棚と金庫が、りゅうおうの沈黙を買った。", "ok");
      } else {
        g.emperor = clamp(g.emperor - 8, 0, 100);
        pushNews(g, "貧しい棚。監査官は何も言わず帰った。", "warn");
      }
    } else {
      g.emperor = clamp(g.emperor - 5, 0, 100);
      pushNews(g, "目を逸らした。剣は、まだ棚の奥だ。", "muted");
    }
  } else if (id === "march") {
    if (choice === "supply") {
      const give = Math.ceil(onHand(g, "oil") / 2);
      takeProduct(g, "oil", give);
      addRep(g, "gabing", 10);
      addPower(g, "gabing", 8);
      g.warHeat = clamp(g.warHeat + 10, 0, 100);
      g.gold += give * 30;
      pushNews(g, `刃油 ${give} を牙兵へ。荒野が熱を持った。`, "warn");
    } else if (choice === "food") {
      const give = Math.min(8, onHand(g, "bento") + onHand(g, "onigiri"));
      let left = give;
      const take = (k: ProductId) => {
        const n = Math.min(onHand(g, k), left);
        takeProduct(g, k, n);
        left -= n;
      };
      take("bento");
      take("onigiri");
      addRep(g, "gabing", 5);
      g.warHeat = clamp(g.warHeat + 3, 0, 100);
      pushNews(g, "弁当を渡した。刃は渡していない。", "muted");
    } else {
      addRep(g, "gabing", -8);
      g.warHeat = clamp(g.warHeat + 2, 0, 100);
      pushNews(g, "シャッターの向こうで、牙が鳴った。", "warn");
    }
  } else if (id === "fog") {
    if (choice === "open") {
      g.campaign = "leaflet";
      g.campaignUntil = nowStamp(g.day, g.hour) + 10;
      addRep(g, "yokuga", 8);
      pushNews(g, "霧の中で缶が開く音。翼牙が客になった。", "ok");
    } else if (choice === "guard") {
      g.storeHp = clamp(g.storeHp + 6, 0, MAX_HP);
      addRep(g, "yokuga", -3);
      addRep(g, "gabing", 4);
      pushNews(g, "警備の影に、霧が折れた。", "muted");
    } else {
      g.warHeat = clamp(g.warHeat + 5, 0, 100);
      takeProduct(g, "mpcan", 3);
      pushNews(g, "MP缶が三本、霧に溶けた。", "warn");
    }
  } else if (id === "skirmish") {
    const live = MONSTER_WARLORD_IDS.filter((w) => warKnown(g, w));
    const a = pick(g, live);
    let b = pick(g, live);
    if (b === a) b = pick(g, live.filter((x) => x !== a));
    const winner = g.warlordPower[a] >= g.warlordPower[b] ? a : b;
    const loser = winner === a ? b : a;
    if (choice === "refugees") {
      addWarRep(g, loser, 8);
      addRep(g, WARLORDS[loser].family, 6);
      g.guestsToday += 6;
      g.gold += 70;
      g.warHeat = clamp(g.warHeat + 6, 0, 100);
      pushNews(g, `${WARLORDS[loser].leader}の敗走が、塩むすびを求めた。`, "ok");
    } else if (choice === "winner") {
      addWarRep(g, winner, 8);
      addWarRep(g, loser, -6);
      addWarPower(g, winner, 6);
      addRep(g, WARLORDS[winner].family, 5);
      g.warContract = winner;
      g.warHeat = clamp(g.warHeat + 12, 0, 100);
      pushNews(g, `${WARLORDS[winner].name}の兵站を、店が引き受けた。`, "warn");
    } else {
      g.warHeat = clamp(g.warHeat - 8, 0, 100);
      addWarRep(g, a, 2);
      addWarRep(g, b, 2);
      pushNews(g, "水だけが、両方の喉を通った。", "muted");
    }
  } else if (id === "goldenslime") {
    if (choice === "serve") {
      g.gold += 180;
      addRep(g, "gelum", 10);
      g.emperor = clamp(g.emperor + 3, 0, 100);
      pushNews(g, "金眼が塩むすびを包んだ。会計が跳ねた。", "ok");
    } else if (choice === "keep") {
      g.dens.radaan = Math.min(attractCap(g), g.dens.radaan + 1);
      addRep(g, "gelum", 12);
      pushNews(g, "金眼は看板の下で眠る。ジェルムが群れ始めた。", "ok");
    } else {
      g.gold += 320;
      addRep(g, "gelum", -10);
      addRep(g, "rinkou", 8);
      pushNews(g, "金眼は鱗侯の帳に消えた。ジェルムの瞳が冷たい。", "warn");
    }
  } else if (id === "ban") {
    if (choice === "hide") {
      g.gold += 90;
      g.emperor = clamp(g.emperor - 7, 0, 100);
      addRep(g, "jumon", 6);
      addRep(g, "kottou", 4);
      pushNews(g, "裏棚は禁令より深い。", "warn");
    } else if (choice === "obey") {
      clearProduct(g, "salt");
      clearProduct(g, "map");
      g.emperor = clamp(g.emperor + 5, 0, 100);
      addRep(g, "jumon", -4);
      pushNews(g, "塩と地図を封じた。塔は満足し、亡者は不満だ。", "muted");
    } else if (onHand(g, "wine") > 0) {
      takeProduct(g, "wine", 1);
      addRep(g, "jumon", 8);
      pushNews(g, "鱗酒が禁令を一枚、薄くした。", "ok");
    } else {
      g.emperor = clamp(g.emperor - 3, 0, 100);
      pushNews(g, "握らせる酒がない。書記は帰った。", "warn");
    }
  } else if (id === "rival") {
    if (choice === "price") {
      g.campaign = "sale";
      g.campaignUntil = nowStamp(g.day, g.hour) + 12;
      pushNews(g, "特売の札が、赤い蛍光に勝つ。", "ok");
    } else if (choice === "grab") {
      const target = DEN_IDS.find(
        (d) => g.dens[d] === 0 && (d !== "hollow" || (g.caveKnown && !g.caveSealed)),
      );
      if (target && g.gold >= Math.round(DENS[target].cost * 0.7)) {
        g.gold -= Math.round(DENS[target].cost * 0.7);
        g.dens[target] = 1;
        g.tutorial.attracted = true;
        pushNews(g, `${DENS[target].name}を先に取った。対抗店の灯が遠い。`, "ok");
      } else {
        g.gold = Math.max(0, g.gold - 80);
        pushNews(g, "急ぐ金が足りず、値引き合戦だけが残った。", "warn");
      }
    } else {
      for (const id of DEN_IDS) {
        if (g.dens[id] > 0 && rand(g) < 0.25) g.dens[id] = Math.max(1, g.dens[id] - 0); // no-op keep
      }
      g.warHeat = clamp(g.warHeat + 2, 0, 100);
      pushNews(g, "対抗店は残った。峠の客が割れる。", "muted");
    }
  } else if (id === "theft") {
    if (choice === "forgive") {
      addRep(g, "kottou", 9);
      takeProduct(g, "onigiri", 4);
      pushNews(g, "塩むすびは、亡者の夜食になった。", "ok");
    } else if (choice === "lock") {
      g.gold += 40;
      pushNews(g, "倉庫の見積が、なぜか安くなった。", "muted");
    } else {
      addRep(g, "kottou", -8);
      g.storeHp = clamp(g.storeHp + 4, 0, MAX_HP);
      pushNews(g, "灯の頭が、店から遠ざかる。", "warn");
    }
  } else if (id === "patrol") {
    if (choice === "feast") {
      if (onHand(g, "chicken") >= 2 && onHand(g, "wine") >= 1) {
        takeProduct(g, "chicken", 2);
        takeProduct(g, "wine", 1);
        g.emperor = clamp(g.emperor + 14, 0, 100);
        addRep(g, "rinkou", 6);
        pushNews(g, "巡幸は満腹で去った。人族のゆうしゃは、まだ客扱いだ。", "ok");
      } else {
        g.emperor = clamp(g.emperor - 9, 0, 100);
        pushNews(g, "並べるものが足りない。りゅうおうの舌が失望した。", "danger");
      }
    } else if (choice === "gold") {
      if (g.gold >= 180) {
        g.gold -= 180;
        g.emperor = clamp(g.emperor + 8, 0, 100);
        pushNews(g, "金貨の山は、言葉より早い。", "ok");
      } else {
        g.emperor = clamp(g.emperor - 8, 0, 100);
        pushNews(g, "空の金庫を、りゅうおうは見た。", "danger");
      }
    } else {
      g.emperor = clamp(g.emperor - 14, 0, 100);
      pushNews(g, "空の棚。巡幸は無言で雲に戻った。", "danger");
    }
  } else if (id === "cavefoot") {
    if (choice === "lamp") {
      g.caveKnown = true;
      g.dens.hollow = Math.max(1, g.dens.hollow);
      addRep(g, "cave", 16);
      g.emperor = clamp(g.emperor - 6, 0, 100);
      if (onHand(g, "lantern") > 0) takeProduct(g, "lantern", 1);
      for (const f of MONSTER_FACTION_IDS) addRep(g, f, -2);
      g.tutorial.attracted = true;
      pushNews(g, "西の断崖へ灯を渡した。ダンジョンの人間が客になった。地上の国ではない。逃げた者だ。", "ok");
    } else if (choice === "pass") {
      g.caveKnown = true;
      addRep(g, "cave", 7);
      g.emperor = clamp(g.emperor - 2, 0, 100);
      pushNews(g, "人間を通した。地図の西端に、まだ印はない。", "muted");
    } else {
      g.caveSealed = true;
      g.caveKnown = true;
      g.dens.hollow = 0;
      addRep(g, "cave", -30);
      addRep(g, "gabing", 8);
      g.emperor = clamp(g.emperor + 11, 0, 100);
      g.warHeat = clamp(g.warHeat + 8, 0, 100);
      purgeCaveShelter(g);
      pushNews(g, "注進した。ダンジョンは空になる。人間は、地上に戻らない。", "warn");
    }
  } else if (id === "cavehunt") {
    if (choice === "tell") {
      g.caveSealed = true;
      g.dens.hollow = 0;
      addRep(g, "cave", -24);
      addRep(g, "gabing", 12);
      addPower(g, "gabing", 6);
      g.emperor = clamp(g.emperor + 7, 0, 100);
      g.warHeat = clamp(g.warHeat + 10, 0, 100);
      purgeCaveShelter(g);
      pushNews(g, "道を教えた。牙兵がダンジョンへ降りた。レジに、人間は来ない。", "danger");
    } else if (choice === "lie") {
      if (onHand(g, "map") > 0) takeProduct(g, "map", 1);
      addRep(g, "gabing", -7);
      addRep(g, "cave", 10);
      g.emperor = clamp(g.emperor - 5, 0, 100);
      g.warHeat = clamp(g.warHeat + 4, 0, 100);
      pushNews(g, "嘘の地図。牙兵は沼を回り、ダンジョンはもう一晩息をする。", "ok");
    } else {
      const give = Math.min(6, onHand(g, "onigiri"));
      takeProduct(g, "onigiri", give);
      addRep(g, "gabing", 3);
      addRep(g, "cave", 4);
      pushNews(g, "塩むすびで時間を買った。狩りは、明日に延びた。", "muted");
    }
  } else if (id === "secondwar") {
    if (choice === "pick") {
      if (g.warContract) {
        addWarPower(g, g.warContract, 12);
        addWarRep(g, g.warContract, 8);
        for (const w of MONSTER_WARLORD_IDS) {
          if (w !== g.warContract) addWarRep(g, w, -6);
        }
        g.warHeat = clamp(g.warHeat + 16, 0, 100);
        pushNews(g, `${WARLORDS[g.warContract].leader}へ全卸し。他の旗が店を睨む。`, "warn");
      } else {
        g.warHeat = clamp(g.warHeat + 10, 0, 100);
        pushNews(g, "契約がない兵站は、すべての旗を怒らせた。", "danger");
      }
    } else if (choice === "open") {
      g.gold += 80;
      g.warHeat = clamp(g.warHeat - 12, 0, 100);
      for (const f of MONSTER_FACTION_IDS) addRep(g, f, 3);
      pushNews(g, "安売りで十一の旗を同時に客にした。利益は薄い。店は残った。", "ok");
    } else {
      g.guestsToday = 0;
      g.storeHp = clamp(g.storeHp + 6, 0, MAX_HP);
      g.warHeat = clamp(g.warHeat - 4, 0, 100);
      pushNews(g, "シャッターを下ろした。内乱は店の前を通り過ぎた。", "muted");
    }
  } else if (id === "eyequiz") {
    if (choice === "mine") {
      if (g.gold >= 400) {
        g.gold -= 400;
        g.emperor = clamp(g.emperor + 6, 0, 100);
        pushNews(g, "店の胃だ、と答えた。金貨が片目を閉じさせた。", "ok");
      } else {
        g.emperor = clamp(g.emperor - 14, 0, 100);
        pushNews(g, "金のない傲慢。りゅうおうの目が細くなる。", "danger");
      }
    } else if (choice === "yours") {
      g.emperor = clamp(g.emperor + 12, 0, 100);
      for (const f of MONSTER_FACTION_IDS) addRep(g, f, -4);
      pushNews(g, "りゅうおうの胃だ、と答えた。魔物のネームドが、客の顔を消す。", "warn");
    } else {
      g.emperor = clamp(g.emperor + 2, 0, 100);
      g.warHeat = clamp(g.warHeat - 3, 0, 100);
      pushNews(g, "誰の胃でもない。蛍光だけが残った。", "muted");
    }
  }

  evalFeats(g);
  const end = checkEnding(g);
  if (end) applyEnding(g, end);
  else if (g.phase === "playing") resumeSpeed(g);
  return g;
}

export function tickHour(state: GameState): GameState {
  const g = clone(state);
  if (g.phase !== "playing" || g.pendingEvent || g.ending || g.clearModal) return g;

  g.hour += 1;
  if (g.hour >= 24) {
    g.hour = 0;
    g.day += 1;
    endOfDay(g);
    evalFeats(g);
    if (g.era === "scenario" && g.day > FINAL_DAY) {
      g.scenarioEnding = rankScenario(g);
      g.clearModal = "scenario";
      pauseForInterrupt(g);
      pushNews(g, "三十六の夜が明けた。シナリオクリア。内乱は、まだ朝を迎えていない。", "ok");
      return g;
    }
  }

  const stamp = nowStamp(g.day, g.hour);
  if (g.campaign && g.campaignUntil && stamp >= g.campaignUntil) {
    pushNews(g, `${CAMPAIGNS[g.campaign].name}が切れた。`, "muted");
    g.campaign = null;
    g.campaignUntil = 0;
  }

  if (isDeliveryHour(g.hour)) runDelivery(g);
  else staffRestock(g);

  const lam = trafficForHour(g);
  const n = Math.min(g.era === "endless" ? 12 : 9, poisson(g, lam));
  const fresh: FloorVisit[] = [];
  for (let i = 0; i < n; i++) {
    const fac = pickFaction(g);
    const patron = pickPatron(g, fac);
    const fav = PATRONS[patron]?.favorite;
    const want = pickWant(g, fac, fav, PATRONS[patron]?.purse ?? 40, g.patrons[patron]?.level ?? 1);
    fresh.push(beginVisit(g, fac, want, patron));
  }
  const stay = g.lastVisits.filter((v) => !v.left);
  const room = Math.max(0, 14 - stay.length);
  g.lastVisits = [...stay, ...fresh.slice(0, room)];
  if (g.gold > g.peakGold) g.peakGold = g.gold;

  maybeRaid(g);
  civilWarClash(g);
  maybeEvent(g);
  evalFeats(g);

  const end = checkEnding(g);
  if (end) applyEnding(g, end);
  return g;
}

export function orderStock(state: GameState, id: ProductId, qty: number): ActionResult {
  if (qty <= 0) return { ok: false, error: "数量が不正です。" };
  const g = clone(state);
  const cost = orderCost(g, id, qty);
  if (g.gold < cost) return { ok: false, error: `資金不足（${cost}G）。` };
  const leftover = putOnShelves(g, id, qty);
  const cap = stockCap(g.facilities.warehouse);
  if (totalStock(g.inventory) + leftover > cap) {
    return { ok: false, error: `倉庫が満杯です（上限 ${cap}）。棚の空きを増やすか、倉庫を拡張しろ。` };
  }
  g.gold -= cost;
  g.inventory[id] += leftover;
  g.tutorial.ordered = true;
  const onto = qty - leftover;
  const msg =
    leftover > 0
      ? `${PRODUCTS[id].name} 棚へ${onto}、倉庫へ${leftover}（${cost}G・定価）。`
      : `${PRODUCTS[id].name} ×${qty} を棚へ即納（${cost}G・定価）。`;
  return { ok: true, state: g, message: msg };
}

function staffRestock(g: GameState) {
  if (hasStaff(g, "stocker")) {
    restockFromWarehouse(g, 999, STAFF.stocker.name);
    return;
  }
  if (hasStaff(g, "clerk")) restockFromWarehouse(g, 8, STAFF.clerk.name);
}

function autoUnitCost(g: GameState, id: ProductId): number {
  const disc = hasStaff(g, "scribe") ? 0.9 : 1;
  return Math.max(1, Math.round(PRODUCTS[id].cost * AUTO_ORDER_RATE * disc));
}

function runDelivery(g: GameState) {
  pourWarehouseToShelves(g);
  const lines: string[] = [];
  let spent = 0;
  let short = false;
  const list = gondolas(g).slice().sort((a, b) => {
    const ra = (a.stock ?? 0) / Math.max(1, a.capacity ?? 1);
    const rb = (b.stock ?? 0) / Math.max(1, b.capacity ?? 1);
    return ra - rb;
  });
  for (const f of list) {
    if (!isGondola(f)) continue;
    const cap = f.capacity ?? 20;
    const point = f.reorderBelow ?? 0;
    if (point <= 0) continue;
    if ((f.stock ?? 0) > point) continue;
    const need = cap - (f.stock ?? 0);
    if (need <= 0) continue;
    const unit = autoUnitCost(g, f.product);
    let qty = need;
    while (qty > 0 && g.gold < unit * qty) qty -= 1;
    if (qty <= 0) {
      short = true;
      continue;
    }
    g.gold -= unit * qty;
    f.stock = (f.stock ?? 0) + qty;
    pushShelfLog(g, f, qty, "order");
    spent += unit * qty;
    lines.push(`${PRODUCTS[f.product].name}+${qty}`);
    g.tutorial.ordered = true;
  }
  if (lines.length) {
    pushNews(g, `定期便（2割引き） ${lines.join("、")}。${spent}G。`, "ok");
  } else if (short) {
    pushNews(g, "定期便が来たが、発注する金がない。", "warn");
  }
}

export function attractDen(state: GameState, id: DenId): ActionResult {
  const g = clone(state);
  if (id === "hollow" && !g.caveKnown) {
    return { ok: false, error: "そのダンジョンは、まだ地図にない。" };
  }
  if (id === "hollow" && g.caveSealed) {
    return { ok: false, error: "ダンジョンは空だ。注進のあとに、人間は残っていない。" };
  }
  const lv = g.dens[id];
  if (lv >= attractCap(g)) return { ok: false, error: "これ以上は誘致できない。" };
  const den = DENS[id];
  if (den.faction === "rinkou" && !g.facilities.wyvern && id === "claw" && lv === 0) {
    return { ok: false, error: "竜用駐機がなければ、紅妃キセラは降りない。" };
  }
  const cost = Math.round(den.cost * (1 + lv * 0.7));
  if (g.gold < cost) return { ok: false, error: `誘致資金が足りない（${cost}G）。` };
  g.gold -= cost;
  g.dens[id] = lv + 1;
  addRep(g, den.faction, 7);
  addPower(g, den.faction, 4);
  addWarRep(g, den.warlord, 8);
  addWarPower(g, den.warlord, 6);
  g.warHeat = clamp(g.warHeat + (den.raid * 8 + 2), 0, 100);
  g.tutorial.attracted = true;
  evalFeats(g);
  const verb = lv === 0 ? "誘致した" : "誘致を深めた";
  if (id === "hollow") {
    g.emperor = clamp(g.emperor - 5, 0, 100);
    for (const f of MONSTER_FACTION_IDS) addRep(g, f, -2);
    pushNews(g, `${den.name}へ灯を運んだ。${WARLORDS.revan.leader}の腹が、店に紐づく。`, "warn");
    return { ok: true, state: g, message: `${den.name} ${verb}（${cost}G）。りゅうおうは見ていない、と願え。` };
  }
  const verbNews = lv === 0 ? "誘致した" : "誘致を深めた";
  pushNews(g, `${den.name}を${verbNews}。${WARLORDS[den.warlord].leader}の兵站が太る。`, "ok");
  return { ok: true, state: g, message: `${den.name} ${verb}（${cost}G）。` };
}

export function hireStaff(state: GameState, id: StaffId): ActionResult {
  const g = clone(state);
  if (g.staff.includes(id)) return { ok: false, error: "すでに雇っている。" };
  if (id === "hermit") {
    if (!g.caveKnown) return { ok: false, error: "雇う人間が、ダンジョンから出てこない。" };
    if (g.caveSealed) return { ok: false, error: "ダンジョンは空だ。" };
  }
  const s = STAFF[id];
  if (g.gold < s.hire) return { ok: false, error: `雇用資金が足りない（${s.hire}G）。` };
  g.gold -= s.hire;
  g.staff.push(id);
  addRep(g, s.faction, 8);
  if (id === "hermit") {
    g.emperor = clamp(g.emperor - 4, 0, 100);
    for (const f of MONSTER_FACTION_IDS) addRep(g, f, -2);
    pushNews(g, "洞人夜番がレジに立った。国の店員ではない。ダンジョンから出てきた。", "warn");
    return { ok: true, state: g, message: "洞人夜番 着任。りゅうおうは見ていない、と願え。" };
  }
  pushNews(g, `${s.name}を雇った。`, "ok");
  if (id === "stocker") {
    return { ok: true, state: g, message: "倉庫係 着任。倉庫の品が、毎時棚へ出る。" };
  }
  return { ok: true, state: g, message: `${s.name} 着任。` };
}

export function fireStaff(state: GameState, id: StaffId): ActionResult {
  const g = clone(state);
  if (!g.staff.includes(id)) return { ok: false, error: "在籍していない。" };
  g.staff = g.staff.filter((x) => x !== id);
  addRep(g, STAFF[id].faction, -6);
  pushNews(g, `${STAFF[id].name}が店を出た。`, "warn");
  return { ok: true, state: g, message: `${STAFF[id].name} を解雇。` };
}

export function placeFixture(
  state: GameState,
  catalogId: CatalogId,
  x: number,
  y: number,
  rot: 0 | 1 | 2 | 3 = 0,
): ActionResult {
  const g = clone(state);
  const item = catalogById(catalogId);
  if (!item) return { ok: false, error: "その什器はない。" };
  if (isWall(x, y) || isDoor(x, y)) return { ok: false, error: "壁と入口には置けない。" };
  if (fixtureAt(g.layout, x, y)) return { ok: false, error: "そこは塞がっている。" };
  const facId = item.facility ?? KIND_TO_FACILITY[item.kind];
  if (facId) {
    const lv = g.facilities[facId];
    if (lv >= facilityCap(g, facId)) return { ok: false, error: "これ以上は置けない。" };
  } else if (item.kind === "shelf") {
    const n = countProductShelf(g.layout, item.product ?? "onigiri");
    if (n >= 4) return { ok: false, error: "同じ棚は四までだ。" };
    const total = g.layout.filter((f) => f.kind === "shelf").length;
    if (total >= 16) return { ok: false, error: "ゴンドラが多すぎる。" };
  }
  const cost = facId ? nextBuildCost(g, facId) : item.cost;
  if (g.gold < cost) return { ok: false, error: `改装費が足りない（${cost}G）。` };
  g.gold -= cost;
  g.layout.push(
    withShelfStock({
      uid: g.layoutUid++,
      kind: item.kind,
      x,
      y,
      rot,
      product: item.product,
    }),
  );
  syncFacilities(g);
  if (!hasRegisterPath(g) && item.kind !== "lamp") {
    return { ok: false, error: "入口からレジへ通路がない。" };
  }
  g.tutorial.designed = true;
  pushNews(g, `${item.name}を置いた。`, "ok");
  evalFeats(g);
  return { ok: true, state: g, message: `${item.name} 配置（${cost}G）。` };
}

export function autoPlaceFixture(state: GameState, catalogId: CatalogId): ActionResult {
  const item = catalogById(catalogId);
  if (!item) return { ok: false, error: "その什器はない。" };
  const slot = firstFreeSlot(state, item.kind);
  if (!slot) return { ok: false, error: "空きマスがない。改装で場所を空けろ。" };
  return placeFixture(state, catalogId, slot.x, slot.y);
}

export function moveFixture(state: GameState, uid: number, x: number, y: number): ActionResult {
  const g = clone(state);
  const f = g.layout.find((it) => it.uid === uid);
  if (!f) return { ok: false, error: "その什器はない。" };
  if (isWall(x, y) || isDoor(x, y)) return { ok: false, error: "壁と入口には置けない。" };
  const occ = fixtureAt(g.layout, x, y);
  if (occ && occ.uid !== uid) return { ok: false, error: "そこは塞がっている。" };
  f.x = x;
  f.y = y;
  if (!hasRegisterPath(g)) return { ok: false, error: "入口からレジへ通路がない。" };
  g.tutorial.designed = true;
  return { ok: true, state: g, message: "移した。" };
}

export function rotateFixture(state: GameState, uid: number): ActionResult {
  const g = clone(state);
  const f = g.layout.find((it) => it.uid === uid);
  if (!f) return { ok: false, error: "その什器はない。" };
  f.rot = ((f.rot + 1) % 4) as 0 | 1 | 2 | 3;
  return { ok: true, state: g };
}

export function removeFixture(state: GameState, uid: number): ActionResult {
  const g = clone(state);
  const i = g.layout.findIndex((it) => it.uid === uid);
  if (i < 0) return { ok: false, error: "その什器はない。" };
  const f = g.layout[i]!;
  if (f.kind === "register" && countKind(g.layout, "register") <= 1) {
    return { ok: false, error: "最後のレジは外せない。" };
  }
  if (isGondola(f) && (f.stock ?? 0) > 0) {
    g.inventory[f.product] += f.stock ?? 0;
  }
  g.layout.splice(i, 1);
  syncFacilities(g);
  const item = CATALOG.find((c) => c.kind === f.kind && (c.product ?? undefined) === f.product);
  const refund = Math.round((item?.cost ?? 50) * 0.6);
  g.gold += refund;
  if (!hasRegisterPath(g)) return { ok: false, error: "入口からレジへ通路がない。" };
  pushNews(g, `${item?.name ?? "什器"}を外した。${refund}G 戻った。`, "muted");
  return { ok: true, state: g, message: `撤去 +${refund}G` };
}

const FACILITY_CATALOG: Record<FacilityId, CatalogId> = {
  register: "register",
  hotcase: "shelf-chicken",
  lighting: "lamp",
  atm: "atm",
  golem: "golem",
  delivery: "hatch",
  wyvern: "perch",
  warehouse: "crate",
};

export function buildFacility(state: GameState, id: FacilityId): ActionResult {
  return autoPlaceFixture(state, FACILITY_CATALOG[id]);
}

export function setShelfPolicy(
  state: GameState,
  uid: number,
  patch: { capacity?: number; reorderBelow?: number },
): ActionResult {
  const g = clone(state);
  const f = g.layout.find((it) => it.uid === uid);
  if (!f || !isGondola(f)) return { ok: false, error: "その棚はない。" };
  const cap = clamp(Math.round(patch.capacity ?? f.capacity ?? 20), 8, 48);
  let reorder = patch.reorderBelow ?? f.reorderBelow ?? 0;
  reorder = clamp(Math.round(reorder), 0, cap);
  const extra = Math.max(0, (f.stock ?? 0) - cap);
  if (extra > 0) {
    g.inventory[f.product] += extra;
    f.stock = cap;
  }
  f.capacity = cap;
  f.reorderBelow = reorder;
  g.tutorial.designed = true;
  return { ok: true, state: g };
}

export function startCampaign(state: GameState, kind: Exclude<CampaignKind, null>): ActionResult {
  const g = clone(state);
  const c = CAMPAIGNS[kind];
  if (g.gold < c.cost) return { ok: false, error: `資金不足（${c.cost}G）。` };
  g.gold -= c.cost;
  if (kind === "tribute") {
    g.emperor = clamp(g.emperor + 14, 0, 100);
    addRep(g, "rinkou", 5);
    pushNews(g, "金貨が空へ消えた。りゅうおうの片目が緩む。部下の礼ではない。", "ok");
    return { ok: true, state: g, message: "沈黙を買った。" };
  }
  g.campaign = kind;
  g.campaignUntil = nowStamp(g.day, g.hour) + c.hours;
  pushNews(g, `${c.name}を開始。`, "ok");
  return { ok: true, state: g, message: `${c.name} 開始。` };
}

export function giftFaction(state: GameState, id: WarlordId): ActionResult {
  const g = clone(state);
  const cost = 110;
  if (g.gold < cost) return { ok: false, error: `手土産が足りない（${cost}G）。` };
  if (!warKnown(g, id)) return { ok: false, error: "渡す相手がいない。" };
  const w = WARLORDS[id];
  g.gold -= cost;
  addWarRep(g, id, 12);
  addRep(g, w.family, 6);
  addWarPower(g, id, 2);
  for (const other of WARLORD_IDS) {
    if (other === id) continue;
    addWarRep(g, other, WARLORDS[other].family === w.family ? -5 : -1);
  }
  if (id === "revan") {
    g.emperor = clamp(g.emperor - 3, 0, 100);
    pushNews(g, "塩むすびをダンジョンへ運んだ。灰将の残数が温まった。", "muted");
    return { ok: true, state: g, message: `${w.leader} との関係が温まった。` };
  }
  pushNews(g, `${w.leader}へ手土産。同じ種の他旗が眉をひそめる。`, "muted");
  return { ok: true, state: g, message: `${w.leader} との関係が温まった。` };
}

export function signContract(state: GameState, id: WarlordId): ActionResult {
  const g = clone(state);
  if (!warKnown(g, id)) return { ok: false, error: "匿う相手がいない。" };
  if (g.warContract === id) return { ok: false, error: "すでに兵站契約中。" };
  const w = WARLORDS[id];
  g.warContract = id;
  addWarRep(g, id, 10);
  addWarPower(g, id, 7);
  addRep(g, w.family, 6);
  addPower(g, w.family, 4);
  for (const other of WARLORD_IDS) {
    if (other === id) continue;
    addWarRep(g, other, WARLORDS[other].family === w.family ? -8 : -3);
  }
  if (id === "revan") {
    g.warHeat = clamp(g.warHeat + 8, 0, 100);
    g.emperor = clamp(g.emperor - 12, 0, 100);
    pushNews(g, "灰将レヴァンを匿った。兵站ではない。隠れ家だ。", "warn");
    return { ok: true, state: g, message: "地下連邦を匿った。りゅうおうの片目が、遠ざかる。" };
  }
  g.warHeat = clamp(g.warHeat + 14, 0, 100);
  g.emperor = clamp(g.emperor - 3, 0, 100);
  pushNews(g, `${w.name}（${w.leader}）と兵站契約。十一の旗から、一つを選んだ。`, "warn");
  return { ok: true, state: g, message: `${w.leader} の御用達になった。` };
}

export function breakContract(state: GameState): ActionResult {
  const g = clone(state);
  if (!g.warContract) return { ok: false, error: "契約がない。" };
  const id = g.warContract;
  const w = WARLORDS[id];
  g.warContract = null;
  addWarRep(g, id, -12);
  g.warHeat = clamp(g.warHeat - 6, 0, 100);
  if (id === "revan") {
    pushNews(g, "灰将の庇護を切った。ダンジョンは、またひとりになる。", "warn");
    return { ok: true, state: g, message: "庇護を切った。" };
  }
  pushNews(g, `${w.leader}との兵站を切った。旗は、また十一に戻る。`, "warn");
  return { ok: true, state: g, message: "契約を破棄した。" };
}

export function beginPlay(state: GameState): GameState {
  const g = clone(state);
  g.phase = "playing";
  g.speed = 1;
  g.heldSpeed = 1;
  return g;
}

export function setSpeed(state: GameState, speed: PlaySpeed): GameState {
  const g = clone(state);
  if (g.pendingEvent || g.ending || g.phase !== "playing" || g.clearModal) {
    g.speed = 0;
    return g;
  }
  g.speed = speed;
  if (speed > 0) g.heldSpeed = speed;
  return g;
}

export function debugAct(state: GameState, kind: DebugKind): ActionResult {
  if (kind === "hour") {
    return { ok: true, state: tickHour(state), message: "1時間進めた。" };
  }
  if (kind === "day") {
    let g = state;
    const start = g.day;
    for (let i = 0; i < 24 && g.day === start && !g.ending && !g.clearModal && !g.pendingEvent; i++) {
      g = tickHour(g);
    }
    return { ok: true, state: g, message: "1日進めた。" };
  }
  const g = clone(state);
  if (kind === "gold") {
    g.gold += 500;
    g.peakGold = Math.max(g.peakGold, g.gold);
    return { ok: true, state: g, message: "+500G。" };
  }
  if (kind === "hp") {
    g.storeHp = MAX_HP;
    return { ok: true, state: g, message: "店の傷を消した。" };
  }
  if (kind === "emp") {
    g.emperor = clamp(g.emperor + 25, 0, 100);
    return { ok: true, state: g, message: "黙認を厚くした。" };
  }
  if (kind === "heat") {
    g.warHeat = clamp(g.warHeat - 25, 0, 100);
    return { ok: true, state: g, message: "戦争熱を冷ました。" };
  }
  if (kind === "scrap") {
    if (!g.scrap) g.scrap = emptySold();
    for (const id of PRODUCT_IDS) {
      if (PRODUCTS[id].perish > 0) g.scrap[id] = MAX_SCRAP;
    }
    return { ok: true, state: g, message: "見切りを満タンにした。" };
  }
  if (kind === "shelves") {
    for (const f of gondolas(g)) {
      if (!f.product) continue;
      f.stock = f.capacity ?? defaultCap(f.kind);
    }
    return { ok: true, state: g, message: "棚を満タンにした。" };
  }
  const fac = pickFaction(g);
  const patron = pickPatron(g, fac);
  const fav = PATRONS[patron]?.favorite;
  const want = pickWant(g, fac, fav, PATRONS[patron]?.purse ?? 40, g.patrons[patron]?.level ?? 1);
  const visit = beginVisit(g, fac, want, patron);
  const stay = g.lastVisits.filter((v) => !v.left);
  g.lastVisits = [...stay, visit].slice(-14);
  const who = PATRONS[patron]?.name ?? FACTIONS[fac].short;
  return { ok: true, state: g, message: `${who}を呼んだ。` };
}
