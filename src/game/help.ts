import {
  BAND_LABEL,
  DENS,
  DEN_IDS,
  FACTIONS,
  PRODUCTS,
  PRODUCT_IDS,
  STAFF,
  WARLORDS,
} from "./data";
import { countProductShelf, faceStock, hasRegisterPath } from "./layout";
import type { DayHint, DenId, FactionId, GameState, ProductId, TimeBand, WarlordId } from "./types";

const KEY = "hansekai24-help";

export function loadHelp(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveHelp(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // private mode
  }
}

function peakLabel(fac: FactionId): string {
  const bands = FACTIONS[fac].bands;
  let max = 0;
  for (const v of Object.values(bands)) max = Math.max(max, v);
  const names = (Object.keys(bands) as TimeBand[]).filter((b) => bands[b] >= max - 0.05);
  return names.map((b) => BAND_LABEL[b]).join("・");
}

function names(ids: ProductId[]): string {
  return ids.map((id) => PRODUCTS[id].name).join("、");
}

export function buildDayHint(g: GameState): DayHint {
  const day = g.day - 1;
  const open = DEN_IDS.filter((id) => g.dens[id] > 0 && !(id === "hollow" && (!g.caveKnown || g.caveSealed)));
  const sources =
    open.map((id) => `${DENS[id].name}の${FACTIONS[DENS[id].faction].short}（${peakLabel(DENS[id].faction)}）`).join("、") ||
    "まだ誘致した巣がない";
  const cold = open.filter((id) => g.factionRep[DENS[id].faction] < 12);
  const arrival = [
    `客は誘致した巣から来る。今日開いていたのは${sources}。`,
    "種ごとに厚い時間が違う。ジェルムと牙兵は昼、呪紋は夜明け、鱗侯は黄昏、翼牙と骨灯と洞人は夜から深夜だ。評判が落ちた種は、巣があってもほぼ入らない。",
    cold.length
      ? `今、評判が薄いのは${[...new Set(cold.map((id) => FACTIONS[DENS[id].faction].short))].join("、")}。この種は店の前を通り過ぎる。`
      : "",
    "入った客は入口から棚へ歩き、手に取ってからレジまで歩き、払って外へ出る。棚に出ていない品は、欲しくてもほぼ選ばない。レジまでの床が塞がっていると、来る人数そのものが減る。",
    `この日の会計は${g.guestsToday}人、売上は${g.goldToday}G。買えずに帰った客は${g.missedToday}人。`,
  ]
    .filter(Boolean)
    .join("");

  const tips: string[] = [];
  if (!hasRegisterPath(g)) {
    tips.push("レジまで歩ける道が切れている。客は棚で止まって会計できず、来店も半分以下になる。棚の向きを変えて、入口からレジまで床を通せ。");
  }

  const noShelf = PRODUCT_IDS.filter((id) => g.inventory[id] > 0 && countProductShelf(g.layout, id) === 0);
  if (noShelf.length) {
    tips.push(
      `倉庫に${names(noShelf)}があるのに、その棚が店内にない。客の目に入らないので、ほぼ売れない。設計で棚を置き、その品を割り当てろ。`,
    );
  }

  const bare = PRODUCT_IDS.filter((id) => countProductShelf(g.layout, id) > 0 && faceStock(g, id) === 0);
  const bareWithBack = bare.filter((id) => g.inventory[id] > 0);
  if (bareWithBack.length) {
    const who = g.staff.includes("stocker")
      ? "便は6時、11時、16時、21時だ。それまでの空きは、棚の「これ以下で満タン」を上げると埋まる。"
      : "倉庫係がいないので、便を待たないと棚へ出ない。倉庫係を雇うと、毎時倉庫から棚へ運ぶ。";
    tips.push(`${names(bareWithBack)}の棚が空で、倉庫には残っている。空の棚を見た客は買い逃す。${who}`);
  } else if (bare.length) {
    tips.push(`${names(bare)}の棚が空で、倉庫にも無い。欠品の客は不興になって帰る。次の便の前に、定価でも棚へ入れておけ。`);
  }

  if (g.missedToday > 0) {
    const scrapN = PRODUCT_IDS.reduce((s, id) => s + (g.scrap[id] ?? 0), 0);
    tips.push(
      scrapN > 0
        ? `買えずに帰った${g.missedToday}人には、品が無い者と、財布が足りない者がいる。見切りは定価より安く、今${scrapN}個残っている。無銭の常連は見切りを買うたびに段がつき、次から所持金の底が上がる。`
        : `買えずに帰った${g.missedToday}人は、欲しい棚が空か、所持金が売価に届いていない。安い塩むすびを切らさないと、夜の無銭客が育たない。`,
    );
  }

  const nightThin = open.length > 0 && open.every((id) => {
    const b = FACTIONS[DENS[id].faction].bands;
    return b.night < 0.7 && b.late < 0.7;
  });
  if (nightThin && g.dens.port === 0 && g.dens.catacomb === 0) {
    tips.push("今の巣は昼に厚い。夜と深夜は店が空く。南の港湾を誘致すると翼牙が夜に来て、MP缶と夜行灯が動く。地下の墓所なら骨灯が塩と灯を買う。");
  }

  const lamps = g.layout.filter((f) => f.kind === "lamp").length;
  if (lamps === 0) {
    tips.push("蛍光灯が一本もない。夜と深夜の客は、灯がある店の半分ほどに落ちる。設計で灯を置くと、翼牙と骨灯が寄る。");
  }

  if (!g.campaign) {
    tips.push("今日は呼び込みを出していない。チラシの巻物は来客を増やす。安売りも客は増えるが、一個の利は薄くなる。客が細い日は、チラシのほうが売上に残りやすい。");
  }

  const dayFolk = open.some((id) => DENS[id].faction === "gelum" || DENS[id].faction === "gabing");
  if (dayFolk && g.facilities.hotcase <= 0 && countProductShelf(g.layout, "chicken") === 0) {
    tips.push("ホットケースが無いので、りゅうおうチキンを売れない。ジェルムと牙兵は弁当の次にチキンを欲しがる。ケースを置くと昼の単価が上がる。");
  }

  const far = open.filter((id) => DENS[id].dist >= 2 && !g.facilities.delivery && !g.staff.includes("courier"));
  if (far.length) {
    tips.push(
      `${far.map((id) => DENS[id].name).join("、")}は遠い。配達便も翼牙配達も無いので、その巣からの客が細っている。近い灰都と沼を先に厚くするだけでも、昼の売上は増える。`,
    );
  }

  if (g.caveKnown && !g.caveSealed && g.dens.hollow <= 0) {
    tips.push("西のダンジョンは、もう地図にある。灯を渡して誘致すると洞人が客になる。昼はほぼ来ない。深夜と夜明けに、夜行灯と塩むすびを置いておけ。");
  }

  const wages = g.staff.reduce((s, id) => s + STAFF[id].wage, 0);
  if (wages > 0 && g.goldToday < wages) {
    tips.push(
      `店員の給与が${wages}Gで、今日の売上${g.goldToday}Gでは賄えていない。締めに所持金から引かれる。客の来る時間に、その種が買う棚を先に埋めたほうが、人を増やすより先に効く。`,
    );
  }

  if (tips.length === 0) {
    tips.push("棚は埋まっていて、巣も客を出している。次に伸びるのは、厚い時間の品をもう一段棚に足すことと、まだ誘致していない隣の巣だ。");
  }

  return { day, title: `${day}日目が終わった`, heading: "今日、もっと稼げたこと", arrival, tips: tips.slice(0, 6) };
}

function guardScore(g: GameState): number {
  return g.facilities.golem * 0.22 + (g.staff.includes("guard") ? 0.18 : 0) + g.factionRep.gabing / 400;
}

function hottestDen(g: GameState): DenId | null {
  let best: DenId | null = null;
  let risk = -1;
  for (const id of DEN_IDS) {
    if (g.dens[id] <= 0) continue;
    if (id === "hollow" && (!g.caveKnown || g.caveSealed)) continue;
    if (DENS[id].raid > risk) {
      risk = DENS[id].raid;
      best = id;
    }
  }
  return best;
}

export function buildRaidHint(g: GameState, hurt: number): DayHint {
  const hot = hottestDen(g);
  const hotName = hot ? DENS[hot].name : "誘致した巣";
  const guard = guardScore(g);
  const thick = guard >= 0.55;
  const tips: string[] = [];
  if (!g.staff.includes("guard")) {
    tips.push("牙兵警備を雇うと、夜の襲撃は起きにくくなり、起きても傷が浅い。レジの客とは別に、入口を見ている。");
  }
  if (g.facilities.golem <= 0) {
    tips.push("ゴーレム台が無い。一台置くだけで守りがはっきり厚くなる。蛍光灯は客を呼ぶだけで、襲撃は止めていない。");
  } else if (g.facilities.golem < 2 && !thick) {
    tips.push("ゴーレムはいるが、まだ薄い。もう一台か、牙兵警備と揃えると、傷はかなり減る。");
  }
  if (hot && DENS[hot].raid >= 0.3) {
    tips.push(
      `${hotName}は荒い巣だ。誘致すると客と金は来るが、夜の襲撃の種になる。守りを置いてから深くするか、熱が高いうちは灰都や氷穴のように荒くない巣を先に厚くする。`,
    );
  }
  if (g.warContract) {
    const w = WARLORDS[g.warContract];
    tips.push(
      `${w.leader}と兵站契約している。契約は毎日、戦争熱を少し上げる。熱が高い夜ほど襲われる。契約は勝ち筋と、夜の危険の引き換えだ。`,
    );
  } else if (g.warHeat >= 40) {
    tips.push("兵站契約はしていない。それでも戦争熱が高い。刃油、呪い塩、巣穴地図は売れるほど熱が上がる。夜の前にこの三つだけ棚を薄くすると、襲われにくい。その客は不興になる。");
  }
  if (!thick) {
    tips.push("守りが厚いと、襲撃の確率も傷も落ちる。完全には消えない。厚い店でも、夜はまれに牙が来る。");
  }
  if (g.storeHp <= 40) {
    tips.push("店の傷が深い。このままもう一度来ると、店は燃えて閉店になる。次の夜までに警備かゴーレムを置け。");
  }
  tips.push("持っていかれた品は、棚が空いたまま朝を迎える。ジェルムは空棚を見て帰る。6時の便を待つか、金があるなら今すぐ棚へ入れろ。");
  return {
    day: g.day,
    title: "襲撃を受けた",
    heading: "こうしていれば",
    arrival: `襲撃は夜と深夜だけ、三日目から来る。戦争熱が高いほど、誘致した巣のうち一番荒い場所が危ないほど、起きやすい。今回の傷は${hurt}。一番荒い誘致は${hotName}。戦争熱は${Math.round(g.warHeat)}ほどまで上がった。棚の品も、何割か持っていかれた。りゅうおうの黙認も、少し落ちている。`,
    tips: tips.slice(0, 6),
  };
}

export function buildBreakHint(g: GameState, loser: WarlordId, winner: WarlordId): DayHint {
  const lost = WARLORDS[loser];
  const won = WARLORDS[winner];
  const kin = lost.family === won.family;
  const tips = [
    `${lost.leader}の巣（${DENS[lost.den].name}）を、相手より深く誘致すると、その旗は折れにくい。契約のボーナスも勝敗に乗るが、巣の深さが本体だ。`,
    `${FACTIONS[lost.family].short}の常連が買い物で段を上げると、その種の旗が少し強くなる。契約した側の客を、薄い棚で帰さない。`,
    "負ける旗と契約しなければ、余波の傷はない。勝った側と契約していれば、代わりに御用達の金が落ちる。",
  ];
  if (kin) {
    tips.push(
      `同じ${FACTIONS[lost.family].short}の${lost.leader}と${won.leader}が殴り合った。同じ種の巣を両方誘致すると、この相撃が店の前で起きやすい。片方だけを厚くするほうが、余波は少ない。`,
    );
  }
  if (g.storeHp <= 40) {
    tips.push("余波で店の傷が深い。契約を切るか、その旗の巣を今夜のうちに厚くしないと、次の相撃で閉店まで行く。");
  }
  return {
    day: g.day,
    title: "契約した旗が折れた",
    heading: "こうしていれば",
    arrival: `${lost.leader}が${won.leader}に負けた。兵站契約の相手だったので、負けが店に降りてきた。旗の勝敗は、その旗の力と、巣の深さと、同じ種の中でどの巣が厚いかと、常連の段で傾く。`,
    tips,
  };
}
