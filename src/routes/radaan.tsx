import { createFileRoute, Link } from "@tanstack/react-router";

const SECTIONS = [
  {
    title: "灯が市場を開く",
    body: "灰都の夜市場は、祭りではない。半世界24の蛍光が消えないので、路地が店の光のほうを向いて並ぶ。紫塔ではなく、灯のほうへ屋台が顔を出す。昼の都はヴァロスの預かりだ。夜の都は、閉じていない店のまわりにできる。",
  },
  {
    title: "旗を畳む",
    body: "屋台では旗の布を出さない。昼の名乗りを畳み、胃袋として買う。旗を広げた列は、その夜だけその屋台が閉じる。十一の旗が同じ灰の上に立てるのは、名前を床へ置いたあいだだけだ。争いを禁じる法はない。法の代わりに、並べる場所が狭い。",
  },
  {
    title: "塩が時計",
    body: "最初に置くのは金貨ではない。カウンターの塩が、その屋台の開店だ。店の塩の山に、ほかの山が大きさを合わせる。塩が薄い夜は、市場の声も薄い。流離の翼が芯を測る夜と、市場が静まる夜は、しばしば同じだ。骨灯が灯籠の底から運んだ白と、氷の輪の縁からこぼれた白を、夜は区別しない。区別した者は、朝までその話をしない。",
  },
  {
    title: "胃袋が席",
    body: "ジェルムは市場の椅子だ。直轄の腹と、腹盟の腹は、昼は別の旗でも、塩むすびが消えるまでは同じ列に座る。食べ終わる前に旗の話を始めた者は、次の夜、席を空けて待たされる。催促はない。むすびが先、というだけだ。",
  },
  {
    title: "翼は降りない",
    body: "翼牙は路地に着地しない。着地は、流離か新生かを公衆の前で選ぶことになる。缶と夜行灯は店の裏から受け取り、短路で戻る。羽音が屋根を一度打てば、市場は顔を上げない。上げた顔が、どちらの翼かを見てしまうからだ。",
  },
  {
    title: "骨の灯は売らない",
    body: "骨灯は通路を歩き、亡者が屋台のあいだで迷わないようにする。頭の灯は商品ではない。借りようとした者は、その夜の列から外される。深夜の塩むすびが減ることがあっても、市場はそれを盗みと呼ばない。夜食が歩いて出ていった、と言う。",
  },
  {
    title: "人間の顔",
    body: "人間はダンジョンにいる。夜市場で顔を出してよいのは、店の夜番として立っているときだけだ。布のない人間の顔は、客ではなく、穴からの使いに読まれる。買いものがしたい洞人は、頭を布で隠す。隠した顔は、灰都では礼儀だ。",
  },
  {
    title: "朝の紙",
    body: "ヴァロスの禁令は夜明けに貼られる。次の夜には灰になっている。市場の言い回しでは、朝まで残った紙は、夜のための紙ではなかった。蛍光の二十四は、夜を数え終わらないための数字だ。市場はそれに合わせて、朝が来る前に畳む。",
  },
] as const;

export const Route = createFileRoute("/radaan")({
  head: () => ({
    meta: [
      { title: "灰都の夜市場 — 半世界24" },
      { name: "description", content: "旧王都ラダーンで、蛍光のまわりに開く夜の市場。" },
    ],
  }),
  component: NightMarket,
});

function NightMarket() {
  return (
    <main className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-3xl items-end justify-between gap-4 px-4 pt-5">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-accent">旧王都 · 蛍光のまわり</p>
          <h1 className="font-display text-3xl text-fg">灰都の夜市場</h1>
        </div>
        <Link to="/" className="mb-1 text-sm text-muted hover:text-fg">
          店へ戻る
        </Link>
      </header>
      <article className="mx-auto mt-6 w-full max-w-3xl space-y-4 px-4 pb-12">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-lg border border-border bg-surface px-4 py-4 sm:px-6">
            <h2 className="font-display text-xl text-fg">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
