export type FactionId =
  | "gelum"
  | "yokuga"
  | "gabing"
  | "kottou"
  | "rinkou"
  | "jumon"
  | "cave";

export type WarlordId =
  | "revan"
  | "varos"
  | "hoimu"
  | "yamato"
  | "tsukuyo"
  | "kisera"
  | "garyu"
  | "kazer"
  | "delark"
  | "rokka"
  | "gurea";

export type ProductId =
  | "bento"
  | "mpcan"
  | "chicken"
  | "onigiri"
  | "oil"
  | "salt"
  | "lantern"
  | "map"
  | "wine";

export type DenId =
  | "radaan"
  | "marsh"
  | "pass"
  | "fort"
  | "catacomb"
  | "port"
  | "tower"
  | "ice"
  | "claw"
  | "waste"
  | "hollow";

export type FacilityId =
  | "register"
  | "hotcase"
  | "lighting"
  | "atm"
  | "golem"
  | "delivery"
  | "wyvern"
  | "warehouse";

export type FixtureKind =
  | "shelf"
  | "register"
  | "hotcase"
  | "atm"
  | "lamp"
  | "golem"
  | "hatch"
  | "perch"
  | "crate";

export interface Fixture {
  uid: number;
  kind: FixtureKind;
  x: number;
  y: number;
  rot: 0 | 1 | 2 | 3;
  product?: ProductId;
  capacity?: number;
  stock?: number;
  reorderBelow?: number;
}

export type StaffId = "clerk" | "stocker" | "courier" | "guard" | "night" | "host" | "scribe" | "hermit";

export type TimeBand = "late" | "dawn" | "day" | "dusk" | "night";

export type GamePhase = "intro" | "playing" | "ending";

export type GameEra = "scenario" | "endless";

export type ClearModal = "scenario" | "legend" | null;

export type EndingId =
  | "economy"
  | "neutral"
  | "supply"
  | "survive"
  | "hollow"
  | "legend"
  | "broke"
  | "burned"
  | "audit";

export type FeatId = "banners" | "unify" | "market" | "empire" | "century" | "mercy" | "depths";

export type TabId = "floor" | "map" | "stock" | "people" | "court";

export type CampaignKind = "leaflet" | "sale" | "tribute" | null;

export type NewsTone = "ok" | "warn" | "danger" | "muted";

export type ShelfLogReason = "sale" | "raid" | "waste" | "event" | "restock" | "order" | "clear";

export interface ShelfLog {
  id: number;
  uid: number;
  day: number;
  hour: number;
  product: ProductId;
  delta: number;
  after: number;
  reason: ShelfLogReason;
  who?: string;
}

export type PatronId = string;

export interface PatronMemory {
  lastDay: number;
  lastHour: number;
  visits: number;
  spent: number;
  level?: number;
  nickname?: string;
  purseMul?: number;
  namedDay?: number;
}

export type VisitMood = "happy" | "empty" | "rich";

export interface FloorVisit {
  seq: number;
  faction: FactionId;
  want: ProductId;
  mood: VisitMood;
  patron?: PatronId;
  bought: number;
  purseLeft: number;
  binge: boolean;
  prevDay?: number;
  prevHour?: number;
  visitCount: number;
  spentTotal: number;
  level: number;
  picked: boolean;
  paid: boolean;
  nickname?: string;
  purseMul?: number;
  got?: ProductId;
  bill?: number;
  scrap?: boolean;
  broke?: boolean;
  named?: WarlordId;
  leveledTo?: number;
  left?: boolean;
}

export interface NewsItem {
  id: number;
  day: number;
  hour: number;
  text: string;
  tone: NewsTone;
}

export interface PendingEvent {
  id: string;
  title: string;
  body: string;
  portrait?: "emperor" | FactionId | WarlordId;
  choices: { id: string; label: string; hint?: string }[];
}

export type PlaySpeed = 0 | 1 | 3 | 5 | 10 | 20;
export type FastSpeed = 3 | 5 | 10 | 20;

export interface GameState {
  version: number;
  phase: GamePhase;
  day: number;
  hour: number;
  speed: PlaySpeed;
  /** 割り込みで止める直前の再生速度。0 は未記録。 */
  heldSpeed: PlaySpeed;
  gold: number;
  storeHp: number;
  emperor: number;
  warHeat: number;
  rng: number;
  newsId: number;
  visitSeq: number;
  inventory: Record<ProductId, number>;
  scrap: Record<ProductId, number>;
  facilities: Record<FacilityId, number>;
  staff: StaffId[];
  dens: Record<DenId, number>;
  factionRep: Record<FactionId, number>;
  factionPower: Record<FactionId, number>;
  warlordRep: Record<WarlordId, number>;
  warlordPower: Record<WarlordId, number>;
  warContract: WarlordId | null;
  campaign: CampaignKind;
  campaignUntil: number;
  goldToday: number;
  guestsToday: number;
  missedToday: number;
  soldToday: Record<ProductId, number>;
  goldHistory: number[];
  news: NewsItem[];
  chronicle: NewsItem[];
  shelfLogs: ShelfLog[];
  logSeq: number;
  lastVisits: FloorVisit[];
  pendingEvent: PendingEvent | null;
  ending: EndingId | null;
  era: GameEra;
  scenarioEnding: EndingId | null;
  clearModal: ClearModal;
  feats: Record<FeatId, boolean>;
  peakGold: number;
  tutorial: { ordered: boolean; attracted: boolean; openedMap: boolean; designed: boolean };
  caveKnown: boolean;
  caveSealed: boolean;
  layout: Fixture[];
  layoutUid: number;
  patrons: Record<PatronId, PatronMemory>;
}

export type ActionOk = { ok: true; state: GameState; message?: string };
export type ActionErr = { ok: false; error: string };
export type ActionResult = ActionOk | ActionErr;

export type DebugKind = "gold" | "hour" | "day" | "hp" | "emp" | "heat" | "scrap" | "shelves" | "visit";
