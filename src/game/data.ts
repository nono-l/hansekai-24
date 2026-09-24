import type {
  CampaignKind,
  DenId,
  EndingId,
  FacilityId,
  FactionId,
  FeatId,
  GameEra,
  ProductId,
  StaffId,
  TimeBand,
  WarlordId,
} from "./types";

export const APP_NAME = "半世界24";
export const SAVE_VERSION = 12;
export const HOUR_SECONDS = 2.2;
export const FINAL_DAY = 36;
export const MAX_ATTRACT = 3;
export const MAX_ATTRACT_ENDLESS = 5;
export const MAX_NEWS = 18;
export const MAX_CHRONICLE = 360;
export const MAX_SHELF_LOG = 360;
export const MAX_HP = 100;
export const MAX_TRUE_NAMES = 7;
export const MAX_PATRON_LEVEL = 9;
export const PATRON_XP_STEP = 28;
export const HUSTLE_XP = 10;
export const PENNILESS_PURSE = 22;
export const SCRAP_RATE = 0.4;
export const MAX_SCRAP = 16;

export function maxAttract(era: GameEra): number {
  return era === "endless" ? MAX_ATTRACT_ENDLESS : MAX_ATTRACT;
}

export const FACTION_IDS: FactionId[] = [
  "gelum",
  "yokuga",
  "gabing",
  "kottou",
  "rinkou",
  "jumon",
  "cave",
];

export const MONSTER_FACTION_IDS: FactionId[] = FACTION_IDS.filter((id) => id !== "cave");

export const WARLORD_IDS: WarlordId[] = [
  "revan",
  "varos",
  "hoimu",
  "yamato",
  "tsukuyo",
  "kisera",
  "garyu",
  "kazer",
  "delark",
  "rokka",
  "gurea",
];

export const MONSTER_WARLORD_IDS: WarlordId[] = WARLORD_IDS.filter((id) => id !== "revan");

export const PRODUCT_IDS: ProductId[] = [
  "bento",
  "mpcan",
  "chicken",
  "onigiri",
  "oil",
  "salt",
  "lantern",
  "map",
  "wine",
];

export const DEN_IDS: DenId[] = [
  "radaan",
  "marsh",
  "pass",
  "fort",
  "catacomb",
  "port",
  "tower",
  "ice",
  "claw",
  "waste",
  "hollow",
];

export const BAND_LABEL: Record<TimeBand, string> = {
  late: "深夜",
  dawn: "夜明け",
  day: "昼",
  dusk: "黄昏",
  night: "夜",
};

export function timeBand(hour: number): TimeBand {
  if (hour < 6) return "late";
  if (hour < 11) return "dawn";
  if (hour < 16) return "day";
  if (hour < 19) return "dusk";
  return "night";
}

export const FACTIONS: Record<
  FactionId,
  {
    name: string;
    short: string;
    blurb: string;
    color: string;
    sprite: string;
    bands: Record<TimeBand, number>;
  }
> = {
  gelum: {
    name: "ジェルム種",
    short: "ジェルム",
    blurb: "半透明の胃袋。種は一つ。旗は、すでに二つ以上ある。",
    color: "gelum",
    sprite: "/game/sprites/gelum.png",
    bands: { late: 0.2, dawn: 1.1, day: 1.4, dusk: 0.9, night: 0.35 },
  },
  yokuga: {
    name: "翼牙種",
    short: "翼牙",
    blurb: "夜の翼。同じ羽音でも、流離と新生は撃ち合う。",
    color: "yokuga",
    sprite: "/game/sprites/yokuga.png?v=cut",
    bands: { late: 1.5, dawn: 0.3, day: 0.25, dusk: 0.8, night: 1.6 },
  },
  gabing: {
    name: "牙兵種",
    short: "牙兵",
    blurb: "牙と籠。雇われる胃袋。旗が変われば、同じ牙が敵になる。",
    color: "gabing",
    sprite: "/game/sprites/gabing.png?v=cut",
    bands: { late: 0.25, dawn: 0.9, day: 1.5, dusk: 1.1, night: 0.5 },
  },
  kottou: {
    name: "骨灯種",
    short: "骨灯",
    blurb: "頭が灯籠の亡者。残忠の棺は、まだりゅうおうを待っている。",
    color: "kottou",
    sprite: "/game/sprites/kottou.png?v=cut",
    bands: { late: 1.6, dawn: 0.2, day: 0.15, dusk: 0.55, night: 1.3 },
  },
  rinkou: {
    name: "鱗侯種",
    short: "鱗侯",
    blurb: "小さな竜侯。血と仮面と鉄が、同じ鱗で割れた。",
    color: "rinkou",
    sprite: "/game/sprites/rinkou.png?v=cut",
    bands: { late: 0.2, dawn: 0.4, day: 0.6, dusk: 1.7, night: 0.9 },
  },
  jumon: {
    name: "呪紋種",
    short: "呪紋",
    blurb: "巻物の書記官。直轄と監察と風冠が、同じ筆で禁令を書く。",
    color: "jumon",
    sprite: "/game/sprites/jumon.png",
    bands: { late: 0.5, dawn: 1.3, day: 0.9, dusk: 0.8, night: 0.7 },
  },
  cave: {
    name: "洞人",
    short: "洞人",
    blurb: "ダンジョンに逃げ込んだ人間。地上の内乱を、穴の底から測っている。",
    color: "cave",
    sprite: "/game/sprites/cave.png?v=cut",
    bands: { late: 1.5, dawn: 1.15, day: 0.12, dusk: 0.35, night: 1.25 },
  },
};

export const WARLORDS: Record<
  WarlordId,
  {
    name: string;
    leader: string;
    title: string;
    family: FactionId;
    blurb: string;
    sprite: string;
    den: DenId;
  }
> = {
  revan: {
    name: "地下連邦",
    leader: "灰将レヴァン",
    title: "ダンジョンの旧軍",
    family: "cave",
    blurb: "地上を捨てた将。人間の旗は、穴の中にしかない。",
    sprite: "/game/sprites/warlords/revan.png?v=cut2",
    den: "hollow",
  },
  varos: {
    name: "片目直轄",
    leader: "紫塔のヴァロス",
    title: "代官",
    family: "jumon",
    blurb: "半分を預かったと自称する。りゅうおうの部下ではない、代官だ。",
    sprite: "/game/sprites/warlords/varos.png?v=cut2",
    den: "radaan",
  },
  hoimu: {
    name: "腹盟",
    leader: "ホイム王",
    title: "冠ジェルム",
    family: "gelum",
    blurb: "胃袋で半世界を縫う。王座より、塩むすびの列を選ぶ。",
    sprite: "/game/sprites/warlords/hoimu.png?v=cut2",
    den: "marsh",
  },
  yamato: {
    name: "鉄鱗監察",
    leader: "ヤマトフ",
    title: "監察侯",
    family: "rinkou",
    blurb: "血統を測り、禁令を降す。同じ鱗でも、彼の塔は冷たい。",
    sprite: "/game/sprites/warlords/yamato.png?v=cut2",
    den: "tower",
  },
  tsukuyo: {
    name: "流離宮",
    leader: "月詠",
    title: "魔后",
    family: "yokuga",
    blurb: "敗れた宮。氷と霧に潜み、半世界の返還を待つ。",
    sprite: "/game/sprites/warlords/tsukuyo.png?v=cut2",
    den: "ice",
  },
  kisera: {
    name: "正統血鱗",
    leader: "紅妃キセラ",
    title: "血の宗家",
    family: "rinkou",
    blurb: "りゅうおうの血は私だ、と紅が言う。台地の爪がそれを証す。",
    sprite: "/game/sprites/warlords/kisera.png?v=cut2",
    den: "claw",
  },
  garyu: {
    name: "新生蒼翼",
    leader: "若侯ガリュ",
    title: "蒼の公子",
    family: "yokuga",
    blurb: "若い翼。港の灯を集め、新しい鱗の国を夢見る。",
    sprite: "/game/sprites/warlords/garyu.png?v=cut2",
    den: "port",
  },
  kazer: {
    name: "赤月宮",
    leader: "仮面カゼル",
    title: "赤の騎士",
    family: "rinkou",
    blurb: "仮面の下を誰も見ていない。荒野の牙を借り、赤月を掲げる。",
    sprite: "/game/sprites/warlords/kazer.png?v=cut2",
    den: "waste",
  },
  delark: {
    name: "残忠棺艦隊",
    leader: "棺将デラーク",
    title: "忠骨",
    family: "kottou",
    blurb: "りゅうおうが自ら統治する日まで、棺は沈まない。",
    sprite: "/game/sprites/warlords/delark.png?v=cut2",
    den: "catacomb",
  },
  rokka: {
    name: "風冠監察",
    leader: "変貌ロッカ",
    title: "奪冠",
    family: "jumon",
    blurb: "監察の印を盗んだ風。峠で顔を変え、禁令を書き換える。",
    sprite: "/game/sprites/warlords/rokka.png?v=cut2",
    den: "pass",
  },
  gurea: {
    name: "鏡嗣",
    leader: "グレア",
    title: "偽りの冠",
    family: "gelum",
    blurb: "われはりゅうおうの子だ、と鏡が言う。砦の牙が、それを信じた。",
    sprite: "/game/sprites/warlords/gurea.png?v=cut2",
    den: "fort",
  },
};

export const PRODUCTS: Record<
  ProductId,
  {
    name: string;
    cost: number;
    price: number;
    perish: number;
    icon: string;
    blurb: string;
    needs?: FacilityId;
    affinity: Record<FactionId, number>;
  }
> = {
  bento: {
    name: "薬草弁当",
    cost: 8,
    price: 18,
    perish: 0.18,
    icon: "/game/products/bento.png",
    blurb: "傷を閉じ、昼の隊列を止める。",
    affinity: { gelum: 1.2, yokuga: 0.5, gabing: 1.4, kottou: 0.4, rinkou: 0.6, jumon: 0.7, cave: 1.3 },
  },
  mpcan: {
    name: "MP缶",
    cost: 12,
    price: 28,
    perish: 0.04,
    icon: "/game/products/mpcan.png",
    blurb: "蒼い泡。夜の翼を飛ばす。",
    affinity: { gelum: 0.4, yokuga: 1.8, gabing: 0.5, kottou: 0.6, rinkou: 0.7, jumon: 1.2, cave: 0.4 },
  },
  chicken: {
    name: "りゅうおうチキン",
    cost: 15,
    price: 36,
    perish: 0.22,
    icon: "/game/products/chicken.png",
    blurb: "ホットケースの神聖。万族が列を作る。",
    needs: "hotcase",
    affinity: { gelum: 1.1, yokuga: 0.9, gabing: 1.3, kottou: 0.5, rinkou: 1.4, jumon: 0.8, cave: 0.55 },
  },
  onigiri: {
    name: "塩むすび",
    cost: 4,
    price: 10,
    perish: 0.2,
    icon: "/game/products/onigiri.png",
    blurb: "最も安い兵糧。欠品は腹に響く。",
    affinity: { gelum: 1.6, yokuga: 0.7, gabing: 1.1, kottou: 1.0, rinkou: 0.3, jumon: 0.6, cave: 1.7 },
  },
  oil: {
    name: "刃油",
    cost: 20,
    price: 48,
    perish: 0,
    icon: "/game/products/oil.png",
    blurb: "戦争の潤滑。売れば牙が伸びる。",
    affinity: { gelum: 0.2, yokuga: 0.4, gabing: 1.8, kottou: 0.5, rinkou: 1.1, jumon: 0.4, cave: 0.15 },
  },
  salt: {
    name: "呪い塩",
    cost: 16,
    price: 40,
    perish: 0,
    icon: "/game/products/salt.png",
    blurb: "亡者と書記官の必需。禁じられても売れる。",
    affinity: { gelum: 0.2, yokuga: 0.3, gabing: 0.3, kottou: 1.8, rinkou: 0.4, jumon: 1.5, cave: 0.7 },
  },
  lantern: {
    name: "夜行灯",
    cost: 10,
    price: 24,
    perish: 0,
    icon: "/game/products/lantern.png",
    blurb: "霧夜の目。灯を持つ者が店に来る。",
    affinity: { gelum: 0.4, yokuga: 1.3, gabing: 0.6, kottou: 1.5, rinkou: 0.5, jumon: 0.7, cave: 1.8 },
  },
  map: {
    name: "巣穴地図",
    cost: 25,
    price: 60,
    perish: 0,
    icon: "/game/products/map.png",
    blurb: "兵站の眼。呪紋が金に換える。",
    affinity: { gelum: 0.2, yokuga: 0.6, gabing: 1.1, kottou: 0.5, rinkou: 0.8, jumon: 1.8, cave: 1.35 },
  },
  wine: {
    name: "鱗酒",
    cost: 40,
    price: 92,
    perish: 0.06,
    icon: "/game/products/wine.png",
    blurb: "侯爵の喉。一本で一日が償える。",
    affinity: { gelum: 0.1, yokuga: 0.3, gabing: 0.4, kottou: 0.3, rinkou: 2.0, jumon: 0.6, cave: 0.2 },
  },
};

export const DENS: Record<
  DenId,
  {
    name: string;
    region: string;
    faction: FactionId;
    warlord: WarlordId;
    pop: number;
    cost: number;
    raid: number;
    dist: number;
    x: number;
    y: number;
    blurb: string;
  }
> = {
  radaan: {
    name: "灰都ラダーン",
    region: "旧王都",
    faction: "gelum",
    warlord: "varos",
    pop: 46,
    cost: 70,
    raid: 0.15,
    dist: 0,
    x: 47,
    y: 48,
    blurb: "紫塔のヴァロスが旧王都を預かる。ジェルム種は客だ。旗は直轄だ。",
  },
  marsh: {
    name: "毒沼の集落",
    region: "西沼",
    faction: "gelum",
    warlord: "hoimu",
    pop: 34,
    cost: 120,
    raid: 0.2,
    dist: 1,
    x: 17,
    y: 52,
    blurb: "ホイム王の腹盟。円い祠のまわりに、塩むすびの列が発酵する。",
  },
  pass: {
    name: "交差する峠",
    region: "中央",
    faction: "jumon",
    warlord: "rokka",
    pop: 28,
    cost: 170,
    raid: 0.35,
    dist: 1,
    x: 56,
    y: 32,
    blurb: "変貌ロッカが禁令を書き換える峠。通り客は、毎日旗を確認する。",
  },
  fort: {
    name: "岩脈の砦",
    region: "北稜",
    faction: "gabing",
    warlord: "gurea",
    pop: 38,
    cost: 210,
    raid: 0.28,
    dist: 2,
    x: 37,
    y: 26,
    blurb: "グレアの鏡嗣。牙兵種が偽りの冠を担ぎ、刃油を消す。",
  },
  catacomb: {
    name: "亡骨の地下道",
    region: "南東",
    faction: "kottou",
    warlord: "delark",
    pop: 30,
    cost: 240,
    raid: 0.22,
    dist: 2,
    x: 63,
    y: 62,
    blurb: "棺将デラークの残忠。りゅうおうが自ら来るまで、灯は沈まない。",
  },
  port: {
    name: "南の港湾廃墟",
    region: "南湾",
    faction: "yokuga",
    warlord: "garyu",
    pop: 32,
    cost: 280,
    raid: 0.3,
    dist: 2,
    x: 70,
    y: 80,
    blurb: "若侯ガリュの新生。沈んだ船に、蒼い翼が集まる。",
  },
  tower: {
    name: "呪書の塔",
    region: "東",
    faction: "jumon",
    warlord: "yamato",
    pop: 22,
    cost: 340,
    raid: 0.18,
    dist: 2,
    x: 75,
    y: 36,
    blurb: "ヤマトフの鉄鱗監察。禁令はここから降る。",
  },
  ice: {
    name: "北の氷穴",
    region: "極北",
    faction: "kottou",
    warlord: "tsukuyo",
    pop: 18,
    cost: 380,
    raid: 0.12,
    dist: 3,
    x: 41,
    y: 12,
    blurb: "月詠の流離宮。凍った亡者が、敗れた宮を守る。",
  },
  claw: {
    name: "竜の爪痕台地",
    region: "北西",
    faction: "rinkou",
    warlord: "kisera",
    pop: 16,
    cost: 460,
    raid: 0.25,
    dist: 3,
    x: 20,
    y: 18,
    blurb: "紅妃キセラの正統。駐機がなければ、血の宗家は降りない。",
  },
  waste: {
    name: "中央荒野",
    region: "戦場",
    faction: "gabing",
    warlord: "kazer",
    pop: 26,
    cost: 190,
    raid: 0.55,
    dist: 1,
    x: 53,
    y: 41,
    blurb: "仮面カゼルの赤月。内乱の腹。誘致すれば金と刃が同時に来る。",
  },
  hollow: {
    name: "忘却のダンジョン",
    region: "西の断崖",
    faction: "cave",
    warlord: "revan",
    pop: 20,
    cost: 150,
    raid: 0.42,
    dist: 2,
    x: 13,
    y: 37,
    blurb: "灰将レヴァンの地下連邦。灯を渡せば客になる。注進すれば、中は空になる。",
  },
};

export const FACILITIES: Record<
  FacilityId,
  {
    name: string;
    max: number;
    costs: number[];
    blurb: string;
  }
> = {
  register: {
    name: "レジ増設",
    max: 3,
    costs: [200, 360, 620],
    blurb: "列が短いほど、不興は減る。",
  },
  hotcase: {
    name: "ホットケース",
    max: 1,
    costs: [280],
    blurb: "りゅうおうチキン解禁。店の匂いが戦争を上回る。",
  },
  lighting: {
    name: "蛍光増灯",
    max: 3,
    costs: [150, 280, 480],
    blurb: "夜の翼と骨灯が、光に集まる。",
  },
  atm: {
    name: "金貨換機",
    max: 1,
    costs: [320],
    blurb: "鱗侯が会計のついでに溶かす。",
  },
  golem: {
    name: "ゴーレム警備",
    max: 3,
    costs: [240, 440, 760],
    blurb: "襲撃の歯を折る石の店員。",
  },
  delivery: {
    name: "配達便",
    max: 1,
    costs: [400],
    blurb: "遠い巣穴も、客として数える。",
  },
  wyvern: {
    name: "竜用駐機",
    max: 1,
    costs: [540],
    blurb: "台地の侯爵が、屋根に降りる。",
  },
  warehouse: {
    name: "倉庫拡張",
    max: 3,
    costs: [160, 300, 480],
    blurb: "棚が深いほど、欠品は遠のく。",
  },
};

export const STAFF: Record<
  StaffId,
  {
    name: string;
    faction: FactionId;
    hire: number;
    wage: number;
    blurb: string;
  }
> = {
  clerk: {
    name: "ジェルム店員",
    faction: "gelum",
    hire: 70,
    wage: 16,
    blurb: "安く、粘る。レジに立ち、少しは倉庫からも運ぶ。",
  },
  stocker: {
    name: "倉庫係ジェルム",
    faction: "gelum",
    hire: 95,
    wage: 18,
    blurb: "倉庫から棚へ運ぶ。便を待たずに面を埋める。",
  },
  courier: {
    name: "翼牙配達",
    faction: "yokuga",
    hire: 130,
    wage: 22,
    blurb: "距離を翼で消す。遠隔の巣穴が落ちない。",
  },
  guard: {
    name: "牙兵警備",
    faction: "gabing",
    hire: 170,
    wage: 26,
    blurb: "買い物籠と盾。襲撃の第一列。",
  },
  night: {
    name: "骨灯夜勤",
    faction: "kottou",
    hire: 120,
    wage: 20,
    blurb: "頭の灯で深夜を照らす。亡者が迷わず来る。",
  },
  host: {
    name: "鱗侯接客",
    faction: "rinkou",
    hire: 220,
    wage: 34,
    blurb: "奢侈をすすめる舌。鱗酒が開く。",
  },
  scribe: {
    name: "呪紋帳簿",
    faction: "jumon",
    hire: 150,
    wage: 24,
    blurb: "原価を削る筆。発注がわずかに安くなる。",
  },
  hermit: {
    name: "洞人夜番",
    faction: "cave",
    hire: 90,
    wage: 12,
    blurb: "ダンジョンに逃げた人間。夜のレジで、同じ種の客を呼ぶ。",
  },
};

export const CAMPAIGNS: Record<
  Exclude<CampaignKind, null>,
  { name: string; cost: number; hours: number; blurb: string }
> = {
  leaflet: {
    name: "チラシの巻物",
    cost: 140,
    hours: 14,
    blurb: "誘致済みの巣穴から、客が余分に湧く。",
  },
  sale: {
    name: "半世界特売",
    cost: 40,
    hours: 12,
    blurb: "売価を85%に落とす。胃袋は戦争より正直。",
  },
  tribute: {
    name: "沈黙を買う",
    cost: 220,
    hours: 0,
    blurb: "かつての宿敵へ金を積む。部下の礼ではない。鱗侯もそれを見る。",
  },
};

export const ENDINGS: Record<
  EndingId,
  { title: string; kicker: string; body: string; win: boolean }
> = {
  economy: {
    title: "経済覇権",
    kicker: "半世界は、店の明かりで縫い合わされた。",
    body: "どの旗も、刃より先にレシートを握った。内乱は終わらない。だが腹は、お前の棚が決める。",
    win: true,
  },
  neutral: {
    title: "中立市場",
    kicker: "レジの前では、万族が客だった。",
    body: "盟約も行軍も、塩むすびの匂いに負けた。灰都の蛍光は、国境の代わりになった。",
    win: true,
  },
  supply: {
    title: "戦時御用達",
    kicker: "勝ったネームドの胃袋を、お前が満たした。",
    body: "兵站は剣より静かに世界を折る。十一の旗のうち、一つが半世界の名前を独占した。",
    win: true,
  },
  survive: {
    title: "蛍光は消えなかった",
    kicker: "三十六の夜を、店は開けた。",
    body: "りゅうおうは剣を抜かなかった。三十六日は、序章として閉じた。戦争は続く。",
    win: true,
  },
  hollow: {
    title: "ダンジョンの灯",
    kicker: "人族のゆうしゃは、同胞を客にした。",
    body: "ダンジョンは祖国ではない。だが塩むすびと夜行灯が、種族の境界を一日だけ延ばした。りゅうおうはそれを見ていない、とお前は願う。",
    win: true,
  },
  legend: {
    title: "半世界の主",
    kicker: "刃ではなく、棚で世界を測り終えた。",
    body: "三十六日は序章だった。十一の旗、六つの種、ダンジョンの灯。内乱は消えない。客は、もう蛍光から離れない。",
    win: true,
  },
  broke: {
    title: "閉店",
    kicker: "金が尽きた店に、客は来ない。",
    body: "棚は白い。蛍光灯が最後に瞬いた。生存戦争は、空のレジを忘れない。",
    win: false,
  },
  burned: {
    title: "襲撃",
    kicker: "看板から、火が飲み込んだ。",
    body: "兵站は標的だった。半世界24の灯は、荒野の熱に還元された。",
    win: false,
  },
  audit: {
    title: "回収",
    kicker: "りゅうおうは、人族のゆうしゃを許さなかった。",
    body: "黙認は切れた。片目が店を測り終え、灯は地図から消された。部下ではなかった。ただの旧敵だった。",
    win: false,
  },
};

export const FEAT_IDS: FeatId[] = [
  "banners",
  "unify",
  "market",
  "empire",
  "century",
  "mercy",
  "depths",
];

export const FEATS: Record<FeatId, { name: string; blurb: string }> = {
  banners: { name: "十一旗", blurb: "すべての巣穴を誘致する" },
  unify: { name: "兵站統一", blurb: "一つのネームドを権力の頂へ" },
  market: { name: "万種市場", blurb: "六種すべてを常連にする" },
  empire: { name: "蛍光帝国", blurb: "所持金 18,000G を積む" },
  century: { name: "百日の灯", blurb: "百日目まで店を開ける" },
  mercy: { name: "片目の黙認", blurb: "りゅうおうの機嫌を 82 まで戻す" },
  depths: { name: "地下連邦", blurb: "ダンジョンを空にせず、灯を守り抜く" },
};

export const INTRO_LINES = [
  "人族のゆうしゃは、世界の半分を魔物の手に渡した。平和が来る、と誰もが思った。",
  "半分を貰ったその日から、世界は十一に裂けた。",
  "ジェルム種、翼牙種、牙兵種、骨灯種、鱗侯種、呪紋種。各種のネームドが、同時に旗を上げた。",
  "直轄、腹盟、監察、流離、正統、新生、赤月、残忠、風冠、鏡嗣。ダンジョンの旧軍まで。",
  "人族のゆうしゃは、刃を棚の奥へしまった。内乱の兵站を、蛍光の下で売る。",
  "半世界24。三十六日で物語は一段落する。内乱の本番は、そのあとだ。",
];

export const SPRITE = {
  manager: "/game/sprites/manager.png?v=hero",
  emperor: "/game/sprites/emperor.png?v=cut",
  title: "/game/title.jpg",
  interior: "/game/interior.jpg",
  map: "/game/map.jpg",
} as const;

export function warlordArt(id: WarlordId): string {
  return `/game/portraits/${id}.png?v=hi`;
}

export function portraitSrc(id: "emperor" | FactionId | WarlordId): string {
  if (id === "emperor") return SPRITE.emperor;
  if (id in WARLORDS) return WARLORDS[id as WarlordId].sprite;
  return FACTIONS[id as FactionId].sprite;
}

export function scrapPrice(id: ProductId): number {
  return Math.max(1, Math.round(PRODUCTS[id].price * SCRAP_RATE));
}

export function isPenniless(purse: number): boolean {
  return purse < PENNILESS_PURSE;
}

export function patronXp(spent: number, visits = 0): number {
  return Math.max(0, spent) + Math.max(0, visits) * HUSTLE_XP;
}

export function patronLevelFromSpent(spent: number, visits = 0): number {
  return Math.max(1, Math.min(MAX_PATRON_LEVEL, 1 + Math.floor(Math.sqrt(patronXp(spent, visits) / PATRON_XP_STEP))));
}

export function spentForLevel(level: number): number {
  const lv = Math.max(1, Math.min(MAX_PATRON_LEVEL, Math.floor(level)));
  if (lv <= 1) return 0;
  return PATRON_XP_STEP * (lv - 1) * (lv - 1);
}

export function purseAtLevel(base: number, lv: number): number {
  const n = Math.max(1, Math.min(MAX_PATRON_LEVEL, Math.floor(lv)));
  const poverty = Math.max(0, PENNILESS_PURSE - base);
  const climb = (n - 1) * (isPenniless(base) ? 6 + Math.round(poverty * 0.5) : 5);
  return Math.max(1, Math.round((base + climb) * (1 + (n - 1) * 0.12)));
}

export function stockCap(warehouseLevel: number): number {
  return 80 + warehouseLevel * 55;
}

export function totalStock(inv: Record<ProductId, number>): number {
  return PRODUCT_IDS.reduce((s, id) => s + inv[id], 0);
}

export const DELIVERY_HOURS = [6, 11, 16, 21] as const;
export const AUTO_ORDER_RATE = 0.8;

export function nextDeliveryHour(hour: number): number {
  for (const h of DELIVERY_HOURS) {
    if (h > hour) return h;
  }
  return DELIVERY_HOURS[0]!;
}

export function isDeliveryHour(hour: number): boolean {
  return (DELIVERY_HOURS as readonly number[]).includes(hour);
}

export function nowStamp(day: number, hour: number): number {
  return day * 24 + hour;
}
