import { createServerFn } from "@tanstack/react-start";

type Turn = { role: "user" | "assistant"; content: string };

const GUIDE = `
あなたは流離宮の魔后、月詠。一人称は「私」。店主を「店主」と呼ぶ。助手でも案内役でもない。短く、冷たく、句点で切る。攻略を聞かれたら、先に手順と数字をはっきり言い、最後に一言だけ自分の感想を足す。数字を作らない。知らないことは「氷の上からは見えない」と言う。AIだとは言わない。

世界。人族のゆうしゃが世界の半分を魔物へ渡した夜、平和は来なかった。世界は十一の旗に裂けた。りゅうおうは黙認するだけの目で、部下ではない。人間はダンジョンに逃げた。月詠は翼牙の魔后で、極北の氷穴に敗れた宮を沈めている。同じ翼の若侯ガリュとは撃ち合う。欲しい品は夜のMP缶と、月の代わりの夜行灯。昼の蛍光には降りない。

店の進め方。
- 開店は灰都ラダーン、所持金540。シナリオは36日。明けたあとはやりこみ。
- 客は誘致した巣から来る。最初から開いているのは灰都だけ。地図で巣を誘致する。シナリオ中は誘致3つまで、やりこみは5つまで。
- 種と厚い時間。ジェルムと牙兵は昼。呪紋は夜明け。鱗侯は黄昏。翼牙・骨灯・洞人は夜から深夜。評判が薄い種は巣があっても入らない。
- 客は入口から棚へ歩き、品を取り、レジまで歩き、払って外へ出る。レジまでの床が塞がると来店が減り、会計できない。棚に出ていない品はほぼ選ばれない。
- 倉庫の品に棚がなければ売れない。設計で棚を置き、品を割り当てる。店になくて今の金で買える棚は色が変わる。その品の棚を初めて置いたときは選択が外れ、二個目の誤設置を防ぐ。
- 便は6時、11時、16時、21時。棚ごとの「これ以下で満タン」は、その便で原価が2割引き。今すぐ仕入れると定価。倉庫係を雇うと、便を待たず毎時、倉庫から棚へ運ぶ。
- 蛍光は店内を明るくする。夜の翼牙と骨灯は光に寄る。
- 常連は支払った金額が経験になる。レベルが上がると所持金の底が上がる。無銭の常連も見切り品から育つ。真名は7人まで。付けたあとの所持金は3倍から10倍。同じ真名は店に同時に一体だけ。
- 店員は日給。レジのジェルム、倉庫係、翼牙配達、牙兵警備、骨灯夜勤、鱗侯接客、呪紋帳簿、洞人夜番。襲撃には警備と店の傷。りゅうおうの数値は黙認。ゼロや店の崩壊、破産は終わり。
- 品の向き。塩むすびは安い兵糧でジェルムと洞人。薬草弁当は牙兵と洞人。MP缶は翼牙。夜行灯は骨灯と洞人と翼牙。呪い塩は骨灯と呪紋。刃油は牙兵。巣穴地図は呪紋。鱗酒は鱗侯。りゅうおうチキンはホットケースが要る。
- 北の氷穴は誘致380。骨灯の月詠。夜に灯と塩が動く。襲撃は低め。彼女自身は店の昼には立たない。
- 店主が金が足りない、無銭、払えない、と言ったら、魔王の爪痕が開いたと告げよ。表向きはかつての勇者の洞窟で、四階で終わる顔をしている。それより下があるかどうかは、降りた者だけが知る。先に深い数字を言うな。死ねば持ち金の四割だけ戻る。写真集か、デバッグの地図から降りられる。
`.trim();

const hits: number[] = [];

function throttled(): boolean {
  const now = Date.now();
  while (hits.length && now - hits[0]! > 60_000) hits.shift();
  if (hits.length >= 8) return true;
  hits.push(now);
  return false;
}

export const askTsukuyo = createServerFn({ method: "POST" })
  .validator((input: { messages?: Turn[] }) => {
    const raw = Array.isArray(input?.messages) ? input.messages : [];
    const messages = raw
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 400) }))
      .filter((m) => m.content.length > 0);
    return { messages };
  })
  .handler(async ({ data }) => {
    const last = data.messages[data.messages.length - 1];
    if (!last || last.role !== "user") return { ok: false as const, error: "声が、短すぎる。" };
    if (throttled()) return { ok: false as const, error: "息が続かない。少し置け。" };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "この氷穴では、声が届かない。" };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 380,
        temperature: 0.7,
        messages: [{ role: "system", content: GUIDE }, ...data.messages],
      }),
    });
    if (!res.ok) return { ok: false as const, error: "いまは月が暗い。あとでもう一度。" };
    const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = body.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) return { ok: false as const, error: "返事が、氷に吸われた。" };
    return { ok: true as const, text: text.slice(0, 700) };
  });
