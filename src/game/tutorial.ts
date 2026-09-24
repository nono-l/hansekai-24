import {
  DENS,
  DEN_IDS,
  MAX_TRUE_NAMES,
  PRODUCTS,
  PRODUCT_IDS,
  STAFF,
  maxAttract,
  nowStamp,
} from "./data";
import { countProductShelf, faceStock, hasRegisterPath } from "./layout";
import type { CoachTip, DenId, GameState, ProductId } from "./types";

const KEY = "hansekai24-tutorial";
const MUTE_KEY = "hansekai24-coach-mute";

export const COACH_TIPS: { id: string; label: string }[] = [
  { id: "path", label: "レジまで歩けない" },
  { id: "welcome", label: "まず、時間を進める" },
  { id: "shelves", label: "倉庫の品に棚が無い" },
  { id: "unpause", label: "時間を動かせ" },
  { id: "order", label: "棚が空いている" },
  { id: "guest", label: "客をタップする" },
  { id: "map", label: "地図を開く" },
  { id: "attract", label: "巣を誘致する" },
  { id: "stocker", label: "倉庫係を雇う" },
  { id: "clerk", label: "店員を雇う" },
  { id: "scrap", label: "見切りが残っている" },
  { id: "fast", label: "早送りを長押しする" },
  { id: "court", label: "内乱の長を見る" },
  { id: "name", label: "客に名前を付ける" },
  { id: "policy", label: "棚をタップする" },
];

export function loadCoachMute(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MUTE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, boolean> = {};
    for (const [id, on] of Object.entries(parsed)) {
      if (on === true) out[id] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCoachMute(muted: Record<string, boolean>) {
  try {
    localStorage.setItem(MUTE_KEY, JSON.stringify(muted));
  } catch {
    // private mode
  }
}

export function isCoachMuted(id: string): boolean {
  return loadCoachMute()[id] === true;
}

const SHELF_COST: Record<ProductId, number> = {
  onigiri: 60,
  bento: 70,
  mpcan: 80,
  chicken: 280,
  oil: 90,
  salt: 85,
  lantern: 75,
  map: 95,
  wine: 110,
};

export function loadTutorial(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveTutorial(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // private mode
  }
}

function due(g: GameState, id: string, snooze: number): boolean {
  if (isCoachMuted(id)) return false;
  const seen = g.coachSeen?.[id];
  if (seen == null) return true;
  return nowStamp(g.day, g.hour) - seen >= snooze;
}

function tip(id: string, title: string, body: string, action?: string): CoachTip {
  return { id, title, body, action };
}

export function warehouseMissing(g: GameState): ProductId[] {
  return PRODUCT_IDS.filter((id) => g.inventory[id] > 0 && countProductShelf(g.layout, id) === 0);
}

function affordableShelf(g: GameState): ProductId[] {
  return warehouseMissing(g).filter((id) => g.gold >= SHELF_COST[id]);
}

function emptyFaces(g: GameState): ProductId[] {
  return PRODUCT_IDS.filter((id) => {
    if (countProductShelf(g.layout, id) <= 0 || faceStock(g, id) > 0) return false;
    if (PRODUCTS[id].needs && g.facilities[PRODUCTS[id].needs] <= 0) return false;
    return g.gold >= PRODUCTS[id].cost;
  });
}

function nextDen(g: GameState): { id: DenId; cost: number } | null {
  const cap = maxAttract(g.era);
  let best: { id: DenId; cost: number } | null = null;
  for (const id of DEN_IDS) {
    if (id === "hollow" && !g.caveKnown) continue;
    if (id === "hollow" && g.caveSealed) continue;
    const lv = g.dens[id];
    if (lv >= cap) continue;
    if (DENS[id].faction === "rinkou" && !g.facilities.wyvern && id === "claw" && lv === 0) continue;
    const cost = Math.round(DENS[id].cost * (1 + lv * 0.7));
    if (g.gold < cost) continue;
    if (!best || cost < best.cost) best = { id, cost };
  }
  return best;
}

export function pickCoach(g: GameState): CoachTip | null {
  if (g.phase !== "playing" || g.pendingEvent || g.ending || g.clearModal || g.coach) return null;

  if (!hasRegisterPath(g) && due(g, "path", 1)) {
    return tip(
      "path",
      "レジまで歩けない",
      "客は入口から棚へ歩き、手に取ってからレジまで歩き、払って外へ出る。道が棚で塞がっていると、会計できないし、来る人数も減る。改装するを押して、入口からレジまで床を通せ。",
    );
  }

  if (due(g, "welcome", 10)) {
    return tip(
      "welcome",
      "まず、時間を進める",
      "上の再生で時間が進む。停止で止まる。早送りは長押しすると、3倍、5倍、10倍、20倍から選べる。客は勝手に棚へ歩き、レジを通って外へ出る。下の店内、地図、棚、経営、内乱が、今日できることの全部だ。この案内は、放っておくとまた止まる。",
    );
  }

  const stranded = affordableShelf(g);
  if (stranded.length && due(g, "shelves", 2)) {
    return tip(
      "shelves",
      "倉庫の品に棚が無い",
      `倉庫に${stranded.map((id) => PRODUCTS[id].name).join("、")}がある。棚が無い品は、客の目に入らない。わかっても、時間は止めたままだ。右上の改装するから棚を置き、その品を割り当てろ。必要な棚がそろったら、また案内する。`,
      "わかった。棚を置く",
    );
  }

  const bare = emptyFaces(g);
  if (bare.length && due(g, "order", 2)) {
    return tip(
      "order",
      "棚が空いている",
      `${bare.map((id) => PRODUCTS[id].name).join("、")}の棚が空だ。空を見た客は、買わずに帰る。下の棚を開いて、その品を発注しろ。即納は定価。6時、11時、16時、21時の定期便は二割引きで、棚ごとに決めた個数以下なら満タンにする。`,
    );
  }

  if (g.lastVisits.some((v) => !v.left) && due(g, "guest", 3)) {
    return tip(
      "guest",
      "客をタップする",
      "店内の客をタップすると、所持金、欲しい品、前回いつ来たか、爆買いするかどうかが出る。右の名札で真名を付けると、次から所持金が三倍から十倍になる。同じ真名は、同時に一体までしか来ない。",
    );
  }

  if (!g.tutorial.openedMap && due(g, "map", 2)) {
    return tip(
      "map",
      "地図を開く",
      "下の地図を押せ。ドットが兵站図だ。誘致した巣から客が来る。まだ厚いのは、灰都のジェルムで、昼だ。巣をタップすると、誘致する金と、その土地の旗が出る。",
    );
  }

  const den = g.tutorial.openedMap ? nextDen(g) : null;
  if (den && due(g, "attract", 3)) {
    return tip(
      "attract",
      "巣を誘致する",
      `今の金で誘致できるのは${DENS[den.id].name}、${den.cost}Gだ。地図でその場所をタップして誘致する。誘致した巣の種が、その種の厚い時間に客になる。`,
    );
  }

  const back = PRODUCT_IDS.some(
    (id) => faceStock(g, id) === 0 && countProductShelf(g.layout, id) > 0 && g.inventory[id] > 0,
  );
  if (back && !g.staff.includes("stocker") && g.gold >= STAFF.stocker.hire && due(g, "stocker", 3)) {
    return tip(
      "stocker",
      "倉庫係を雇う",
      `倉庫に品があるのに棚が空だ。経営を開いて、倉庫係ジェルムを雇え。雇う金は${STAFF.stocker.hire}Gで、給与は一日の終わりに別に引かれる。雇うと、便を待たずに倉庫から棚へ運ぶ。店員は店内を歩く。タップすると、今の仕事が見える。`,
    );
  }

  if (g.staff.length === 0 && g.gold >= STAFF.clerk.hire && due(g, "clerk", 4)) {
    return tip(
      "clerk",
      "店員を雇う",
      `経営でジェルム店員を雇える。${STAFF.clerk.hire}Gだ。雇った店員は店内を歩き、レジと棚のあいだを見る。客と同じようにタップできる。給与は一日の終わりに引かれる。`,
    );
  }

  const scrapN = PRODUCT_IDS.reduce((s, id) => s + (g.scrap[id] ?? 0), 0);
  if (scrapN > 0 && due(g, "scrap", 5)) {
    return tip(
      "scrap",
      "見切りが残っている",
      `見切りが${scrapN}個ある。定価の四割だ。金のない常連は、見切りを買うたびに段がつき、次から所持金の底が上がる。高い品を最初から買えない客も、ここから成り上がる。棚の画面に、見切りの数が書いてある。`,
    );
  }

  if ((g.hour >= 9 || g.day > 1) && due(g, "fast", 8)) {
    return tip(
      "fast",
      "早送りを長押しする",
      "上の早送りを長押しすると、3倍、5倍、10倍、20倍が出る。短く押すと、選んである倍率で進む。出来事と、この案内と、一日の終わりのヘルプが出るときは、いったん止まる。",
    );
  }

  if (g.day >= 2 && due(g, "court", 8)) {
    return tip(
      "court",
      "内乱の長を見る",
      "下の内乱を開くと、十一の旗が並ぶ。長の行を押すと、大きい絵が出る。月詠の行からは、写真集へも行ける。契約は勝ち筋だが、毎日戦争熱が上がり、夜の襲撃を呼びやすい。",
    );
  }

  const named = Object.values(g.patrons).filter((m) => m.nickname).length;
  const nameCost = 80 * (named + 1) * (named + 1);
  const nameable = g.lastVisits.some((v) => !v.left && v.patron);
  if (nameable && named < MAX_TRUE_NAMES && g.gold >= nameCost && due(g, "name", 6)) {
    return tip(
      "name",
      "客に名前を付ける",
      `店にいる客の名札は${nameCost}Gで刻める。真名を付けると、次から所持金が三倍から十倍になる。同じ真名は同時に一体までだ。七人まで。金が惜しいなら、よく来る客から付けろ。`,
    );
  }

  if (g.layout.some((f) => f.kind === "shelf" || f.kind === "hotcase") && due(g, "policy", 6)) {
    return tip(
      "policy",
      "棚をタップする",
      "棚をタップすると、容量と、何個以下になったら満タンにするかと、減った履歴が出る。定期便は一日四回、6時、11時、16時、21時だけ来て、その発注は原価の二割引きだ。閾値を上げると欠品が減り、下げると倉庫が眠る。",
    );
  }

  return null;
}

export function shelfWaitStatus(g: GameState): "ready" | "broke" | null {
  const missing = warehouseMissing(g);
  if (!missing.length) return "ready";
  const cheapest = Math.min(...missing.map((id) => SHELF_COST[id]));
  if (g.gold < cheapest) return "broke";
  return null;
}

export function unpauseCoach(kind: "ready" | "broke" = "ready"): CoachTip {
  if (kind === "broke") {
    return tip(
      "unpause",
      "時間を動かせ",
      "今の金では、残りの棚は置けない。上の再生か、この案内を閉じると時間が進む。売って金が戻ったら、また棚の案内が出る。",
      "時間を動かす",
    );
  }
  return tip(
    "unpause",
    "時間を動かせ",
    "倉庫の品に、棚がそろった。この案内を閉じると、時間がまた進む。客は棚へ歩いて、レジを通って出ていく。",
    "時間を動かす",
  );
}

export function armCoach(g: GameState, next: CoachTip, opts?: { resume?: boolean }): GameState {
  const resume = opts?.resume ?? g.speed > 0;
  return {
    ...g,
    heldSpeed: g.speed > 0 ? g.speed : g.heldSpeed,
    speed: 0,
    coachWait: next.id === "unpause" ? null : g.coachWait,
    coachSeen: { ...(g.coachSeen ?? {}), [next.id]: nowStamp(g.day, g.hour) },
    coach: { ...next, resume },
  };
}
