import {
  DENS,
  DEN_IDS,
  ENDINGS,
  FACTIONS,
  FACTION_IDS,
  FEATS,
  FEAT_IDS,
  INTRO_LINES,
  STAFF,
  WARLORDS,
  WARLORD_IDS,
  timeBand,
} from "./data";
import { PATRONS } from "./patrons";
import type { GameState, NewsItem, PatronId } from "./types";

export function seedChronicle(news: NewsItem[]): NewsItem[] {
  return [...news].slice().reverse();
}

function band(n: number): string {
  if (n < 22) return "ほとんど無い";
  if (n < 40) return "薄い";
  if (n < 58) return "並";
  if (n < 78) return "厚い";
  return "支配的";
}

function goldFeel(n: number): string {
  if (n < 0) return "金庫はもう空で、借金だけが残る";
  if (n < 80) return "財布は空に近い";
  if (n < 300) return "細く持てる程度";
  if (n < 800) return "開店の残りが、まだ手にある";
  if (n < 3000) return "棚を足せる余裕";
  if (n < 18000) return "兵站を買える厚み";
  return "蛍光が帝国に見えるほど厚い";
}

function hpFeel(n: number): string {
  if (n < 25) return "店は裂けかけている";
  if (n < 50) return "棚と壁に傷がある";
  if (n < 80) return "傷はあるが灯は保っている";
  return "店はまだ新しい";
}

function empFeel(n: number): string {
  if (n < 20) return "片目が店を測り終えかけている";
  if (n < 40) return "黙認は薄い";
  if (n < 60) return "黙認は続いている";
  if (n < 82) return "片目はまだ逸れている";
  return "片目の黙認は厚い";
}

function heatFeel(n: number): string {
  if (n < 25) return "遠雷程度";
  if (n < 50) return "通りまで熱が届く";
  if (n < 75) return "襲撃を覚悟する熱";
  return "荒野が店を標的にしている";
}

function clockFeel(day: number, hour: number): string {
  const b = timeBand(hour);
  const when =
    b === "late" ? "深夜" : b === "dawn" ? "夜明け" : b === "day" ? "昼" : b === "dusk" ? "黄昏" : "夜";
  return `${day}日目の${when}`;
}

function guestFeel(n: number): string {
  if (n <= 0) return "まだ誰も会計していない";
  if (n < 8) return "客は数えられるほど";
  if (n < 40) return "顔を覚えるほど通っている";
  if (n < 120) return "列が日常になっている";
  return "半世界が胃袋で店を知っている";
}

function purseFeel(mul?: number): string {
  if (!mul || mul <= 1) return "財布は種のまま";
  if (mul < 5) return "真名のあと、財布が厚くなった";
  if (mul < 8) return "真名のあと、財布が異常に厚い";
  return "真名のあと、袋が裂けても金が残る";
}

function regularFeel(visits: number): string {
  if (visits <= 1) return "名を付けたばかり";
  if (visits < 4) return "戻り始めている";
  if (visits < 10) return "常連";
  return "店の一部のように通う";
}

export function buildNovelPrompt(g: GameState): string {
  const era = g.era === "endless" ? "三十六日を越えたやりこみ。本番の内乱。" : "三十六日までの序章。";
  const ending = g.ending ? `${ENDINGS[g.ending].title} — ${ENDINGS[g.ending].kicker}` : "未決着。店はまだ開いている。";
  const scenario = g.scenarioEnding ? ENDINGS[g.scenarioEnding].title : "まだ三十六日を越えていない。";
  const feats = FEAT_IDS.filter((id) => g.feats[id])
    .map((id) => `・${FEATS[id].name}（${FEATS[id].blurb}）`)
    .join("\n");
  const dens = DEN_IDS.filter((id) => g.dens[id] > 0)
    .map((id) => {
      const d = DENS[id];
      const w = WARLORDS[d.warlord];
      const depth = g.dens[id] <= 1 ? "灯が届いた" : g.dens[id] <= 2 ? "灯が根を張った" : "兵站の腹になった";
      return `・${d.name}（${d.region}）${depth} — ${w.leader}／${w.name}`;
    })
    .join("\n");
  const banners = WARLORD_IDS.filter((id) => id !== "revan" || g.caveKnown)
    .map((id) => {
      const w = WARLORDS[id];
      const mark = g.warContract === id ? "店と兵站で結んでいる。" : "";
      return `・${w.leader}（${w.name}／${w.title}／${FACTIONS[w.family].short}）権力は${band(g.warlordPower[id])}。店との距離は${band(g.warlordRep[id])}。${mark}`;
    })
    .join("\n");
  const races = FACTION_IDS.map((id) => {
    const f = FACTIONS[id];
    return `・${f.name} — ${f.blurb} 機嫌は${band(g.factionRep[id])}。地上の勢いは${band(g.factionPower[id])}。`;
  }).join("\n");
  const staff = g.staff.length
    ? g.staff.map((id) => `・${STAFF[id].name}`).join("\n")
    : "・レジは店主だけ。";
  const named = Object.entries(g.patrons)
    .filter(([, m]) => m.nickname)
    .map(([id, m]) => {
      const kind = PATRONS[id as PatronId];
      const who = kind ? kind.name : id;
      return `・真名「${m.nickname}」（元は${who}）${regularFeel(m.visits)}。${purseFeel(m.purseMul)}${m.level && m.level >= 2 ? ` ${m.level}段の常連。` : ""}`;
    })
    .join("\n");
  const log = (g.chronicle.length ? g.chronicle : seedChronicle(g.news))
    .map((n) => `${clockFeel(n.day, n.hour)}｜${n.text}`)
    .join("\n");

  return `あなたは小説家である。以下はゲーム『半世界24』の一プレイの一次資料である。資料は作者用のメモだ。これを根拠に、作品として読めるナラティブ小説を書け。設定解説・攻略・メタな感想は出すな。出力は小説本文のみ（冒頭に題名と一行の副題）。

# 執筆の約束
- 日本語。中編。章を分けてよい。
- 主人公は「人族のゆうしゃ」。りゅうおうの部下ではない。かつての英雄で、今は灰都ラダーンのコンビニ「半世界24」の店主。剣は棚の奥。
- 「りゅうおう」は必ずひらがな四文字。漢字に直すな。
- 人間は地上を捨て、ダンジョンに逃げ込んだ。地上の客は魔物が主。
- 世界観の芯：人族のゆうしゃが世界の半分を魔物へ渡した。平和が来ると思われた。半分を貰ったその日から、世界は十一に裂けた。同じ種でも旗が違う。
- この資料にない国名・軍名・機体名・他作品の固有名は、比喩にも出すな。十一の旗は、この世界の旗としてだけ書け。
- 種は六（ジェルム／翼牙／牙兵／骨灯／鱗侯／呪紋）。旗は十一。ネームドは実名で出せ。
- 日誌の出来事は飛ばすな。箇条書きを並べるな。会話、蛍光灯、塩むすびの匂い、内乱の遠雷、レジの音で書け。
- 日誌にない大戦果・店の消滅・りゅうおうの死は起こすな。空白は日常と内乱の隙間で埋めよ。
- 真名を付けた客は、以後その名で一人の人物として書け。同じ真名は同時に店へ一体しか来ない。
- トーンは暗い生存戦争の中の、小さな温かい店。笑いは乾いたものでよい。
- 結末が「未決着」なら、最後は「つづく」。結末があるならその題に着地せよ。

# 数字を本文に写すな（最重要）
資料の数値・点数・G・HP・権力・関係・黙認・戦争熱・客数・売上は、作者メモである。地の文にも台詞にも、アラビア数字のまま出すな。漢数字に直して並べるな。「所持金は五百四十」「黙認は五十二」「戦争熱は十八」「権力三十六、関係四十八」「累計客、一人」のようなステータス読み上げは禁止。十一の旗を点数表として列挙するな。
翻訳せよ。金は袋の重さ、引き出しの音、買えない棚。傷は壁と蛍光。黙認は天井の気配。戦争熱は通りの牙と遠雷。客は顔と足跡。旗は色、匂い、噂、誰が塩を欲しがるか。日誌に「売上」「欠品」「給与」とあっても、レシートの列ではなく、湯気と空の棚と夕方の沈黙にせよ。店名の「24」と、世界が十一に裂けたことと、三十六日という約束だけは残してよい。時刻は「夜明け」「昼」で足りる。分秒を作るな。

# 世界（動かしてはいけない前提）
${INTRO_LINES.map((l) => `・${l}`).join("\n")}

# このプレイの現在（作者メモ。写経するな）
- 店名：半世界24（灰都ラダーン）
- いま：${clockFeel(g.day, g.hour)}。${era}
- 金：${goldFeel(g.gold)}
- 店：${hpFeel(g.storeHp)}
- りゅうおう：${empFeel(g.emperor)}
- 内乱の熱：${heatFeel(g.warHeat)}
- 客の気配：${guestFeel(g.visitSeq)}
- シナリオ：${scenario}
- 結末：${ending}
- ダンジョン：${g.caveSealed ? "空になった。灯を絶った。" : g.caveKnown ? "人間の気配がある。灰将レヴァンの腹。" : "まだ噂だけ。"}

## 覇業
${feats || "・まだ一つも無い。"}

## 店員
${staff}

## 誘致した巣穴
${dens || "・灰都以外は、まだ灯が届いていない。"}

## 十一の旗（距離と勢いの印象。点数ではない）
${banners}

## 六種の機嫌（印象。点数ではない）
${races}

## 真名の客
${named || "・まだ誰にも真名を刻んでいない。"}

# 日誌（古い順。物語の背骨。数字は情景へ）
${log || "（日誌は開店の一文だけだ。日常から始めよ。）"}

# いま書け
題名、副題、本文。店主の選択は裏切れ。文学として。ステータスは出すな。`;
}
