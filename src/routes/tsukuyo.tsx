import { TsukuyoChat } from "@/components/game/TsukuyoChat";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

const PROFILE = [
  ["名", "月詠"],
  ["呼び", "魔后"],
  ["旗", "流離宮"],
  ["種", "翼牙"],
  ["居", "極北、北の氷穴"],
  ["番", "凍った亡者"],
  ["同じ羽", "若侯ガリュ。新生蒼翼。撃ち合う"],
  ["待っているもの", "渡した半分が、戻ること"],
] as const;

const PLATES = [
  {
    id: "face",
    src: "/game/album/tsukuyo-face.jpg",
    title: "睫の霜",
    body: "流離宮の魔后。月の輪は、まだ頭の上にある。返すべき空は、半分しか残っていない。",
  },
  {
    id: "corridor",
    src: "/game/album/tsukuyo-corridor.jpg",
    title: "折れた回廊",
    body: "氷の廊は折れている。彼女は折れない。待つことだけが、敗れた宮の仕事だ。",
  },
  {
    id: "lake",
    src: "/game/album/tsukuyo-lake.jpg",
    title: "凍った湖",
    body: "翼は朝でも、半分しか収まらない。月が大きくても、宮は遠くの影のままだ。",
  },
  {
    id: "throne",
    src: "/game/album/tsukuyo-throne.jpg",
    title: "空いた座",
    body: "座は空いているのに、彼女は座っている。誰かを待つためではない。宮を、ここに置くためだ。",
  },
  {
    id: "lantern",
    src: "/game/album/tsukuyo-lantern.jpg",
    title: "代わりの月",
    body: "骨の灯を、月の代わりにする。炎は青い。温かくはない。それでも、消さない。",
  },
  {
    id: "shoulder",
    src: "/game/album/tsukuyo-shoulder.jpg",
    title: "振り向けば",
    body: "振り向けば、半分はもう遠い。翼が枠になる。月は、細い。",
  },
  {
    id: "wick",
    src: "/game/album/tsukuyo-wick.jpg",
    title: "芯の長さ",
    body: "塩を芯の横に置く。昔の航路は、この長さでしか戻ってこない。",
  },
  {
    id: "ring",
    src: "/game/album/tsukuyo-ring.jpg",
    title: "氷の下の輪",
    body: "頭の上の月は、片側だけだ。もう片側は空にない。氷が、それを押さえている。",
  },
  {
    id: "route",
    src: "/game/album/tsukuyo-route.jpg",
    title: "降りない短路",
    body: "灰都の蛍光は、下に一つだけ見える。着地はしない。着地は、旗を選ぶことになる。",
  },
  {
    id: "dawn",
    src: "/game/album/tsukuyo-dawn.jpg",
    title: "畳めない朝",
    body: "穴の口まで来ても、片方の翼は畳まれない。朝は、夜の航路を終わらせない。",
  },
] as const;

export const Route = createFileRoute("/tsukuyo")({
  head: () => ({
    meta: [
      { title: "月詠写真集 — 半世界24" },
      { name: "description", content: "流離宮の魔后、月詠。氷と霧の十葉。" },
    ],
  }),
  component: TsukuyoAlbum,
});

function TsukuyoAlbum() {
  const [i, setI] = useState(0);
  const plate = PLATES[i];
  const hashReady = useRef(false);

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (id === "profile") {
      document.getElementById("profile")?.scrollIntoView();
      return;
    }
    const n = PLATES.findIndex((p) => p.id === id);
    if (n >= 0) setI(n);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setI((n) => Math.min(PLATES.length - 1, n + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!hashReady.current) {
      hashReady.current = true;
      return;
    }
    const next = `#${PLATES[i].id}`;
    if (window.location.hash !== next) history.replaceState(null, "", next);
  }, [i]);

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-5xl items-end justify-between gap-4 px-4 pt-5">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-accent">流離宮 · 魔后</p>
          <h1 className="font-display text-3xl text-fg">月詠写真集</h1>
        </div>
        <Link to="/" className="mb-1 text-sm text-muted hover:text-fg">
          店へ戻る
        </Link>
      </header>

      <section id="profile" className="mx-auto mt-6 w-full max-w-5xl px-4">
        <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[9rem_1fr] sm:p-6">
          <img
            src="/game/album/tsukuyo-face.jpg"
            alt=""
            className="mx-auto aspect-[3/4] w-36 rounded-sm object-cover sm:w-full"
          />
          <div>
            <h2 className="font-display text-xl text-fg">プロフィール</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {PROFILE.map(([k, v]) => (
                <div key={k} className="border-b border-border/70 pb-2">
                  <dt className="text-[11px] tracking-wide text-faint">{k}</dt>
                  <dd className="text-sm text-fg">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              人族のゆうしゃが世界の半分を渡した夜、平和が来ると思った者は、北の氷を知らなかった。月詠は敗れた宮を氷穴へ沈め、凍った亡者に番をさせ、月の輪だけを頭に残した。翼は夜のものだ。朝になっても、半分は収まらない。同じ翼牙の若侯とは、同じ羽音で撃ち合う。りゅうおうの部下ではない。流離の宮の主で、返ってくる半分を、まだ待っている。
            </p>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
              <div>
                <h3 className="font-display text-base text-fg">宮が落ちる前</h3>
                <p className="mt-1">
                  月詠は翼牙の魔后だった。宮は月の下にあり、夜の航路を持っていた。りゅうおうに仕えていたわけではない。鱗の血を継いだと名乗ったこともない。彼女の証は冠ではなく、頭の上の細い月と、朝になっても畳みきれない翼だった。生きている翼は夜に飛び、灯の芯を昔の航路で測った。
                </p>
              </div>
              <div>
                <h3 className="font-display text-base text-fg">半分を渡した夜</h3>
                <p className="mt-1">
                  人族のゆうしゃが刃を一度だけ使い、世界の半分を魔物の手へ渡した。平和が来る、と誰もが思った。月詠の空は、渡された側だった。航路が途中で切れ、宮は北へ落ち、氷穴の底で止まった。彼女はそれを贈与と呼ばない。半分を貰ったその日から世界は十一に裂け、同じ翼の中でも旗が二つになった。敗れた宮は流離宮と名を残し、新しい翼は南の沈んだ港で別の国を夢見た。
                </p>
              </div>
              <div>
                <h3 className="font-display text-base text-fg">航路</h3>
                <p className="mt-1">
                  翼牙の航路は、地面の道ではない。月が許した線で、夜にしか開かない。確かめるものは三つだ。頭の上の月の傾き、灯の芯の長さ、そして羽音が宮の拍と揃うこと。三つが揃えば、霧の中でも宮のありかが分かる。地図は地上の控えにすぎない。斥候が霧の図を書き換えても、芯が違えば翼は帰らない。
                </p>
                <p className="mt-2">
                  落ちる前の主な線は、三本だった。宮を一周する月輪。南の湾まで降り、船の灯と会っていた南湾。灰都の上を低く抜け、夜明け前に灯と塩だけを受け取って戻る短路。月輪は今、氷の底の輪そのものだ。南湾は途中で切れていて、切れた先に若侯の港がある。短路だけが、まだ店の夜に届く。
                </p>
                <p className="mt-2">
                  切れた航路は、関所で止まらない。羽ばたきの途中で終わる。古い芯の長さのまま飛び続けると、翼は落ちるか、別の旗の霧へ出る。流離の翼は、輪の縁から採った塩で芯を昔の長さに戻してから飛ぶ。塩が薄い夜は、短路も途中でほどける。ほどけた翼は朝まで外に残り、畳みきれない半分を晒す。新生の翼は月を使わない。港の灯と、飛ぶための缶で新しい線を引く。羽音だけが古い。だから霧の中では、同じ航路の両端が撃ち合う。
                </p>
              </div>
              <div>
                <h3 className="font-display text-base text-fg">翼</h3>
                <p className="mt-1">
                  月詠の翼は、刃ではない。宮の拍そのものだ。ほかの翼が航路を確かめるとき、揃える羽音は彼女の羽ばたきだ。芯と月の傾きが合っていても、拍が彼女と違えば、その翼は流離の宮へは届かない。彼女が飛ばない夜、宮の航路は開かない。
                </p>
                <p className="mt-2">
                  翼には四つの役割がある。飛ぶこと。測ること。降りないこと。数に残ること。飛ぶ翼は夜の線を運ぶ。測る翼は、彼女の拍を基準に自分の羽音を聴く。灰都の上では降りない。着地は、流離か新生かを選ぶ行為になるからだ。南へ行かず、飛ぶこともやめた翼は、氷の中で宮の人数に残る。止まった翼も、役割を捨てていない。
                </p>
                <p className="mt-2">
                  朝になっても畳まれない半分は、飾りでも傷でもない。輪がまだふたつであることの証だ。畳んでしまえば、夜が終わったように見える。月詠はそれを見せない。片翼が開いたまま穴の口に立つのは、航路が途中で切れていることを、宮の外へ出すためだ。新生の翼は燃料で飛び、彼女の拍を基準にしない。同じに聞こえる羽音は、役割を分けたあとに残った古い音だ。
                </p>
              </div>
              <div>
                <h3 className="font-display text-base text-fg">氷穴の番</h3>
                <p className="mt-1">
                  極北には、もとから凍った亡者がいた。冷気が忠誠を腐らせないので、月詠は彼らに番をさせた。宮の主は骨ではない。翼のまま、折れた回廊に座っている。生きている翼の一部は残り、一部は南へ飛んだ。残った者は夜行灯を一つだけ買い、霧の中で昔の道を確かめる。南へ行った者は、若い公子の港で缶を翼の燃料にする。
                </p>
              </div>
              <div>
                <h3 className="font-display text-base text-fg">同じ羽音</h3>
                <p className="mt-1">
                  若侯ガリュは蒼い翼を集め、沈んだ船の上に新しい国を置こうとする。月詠はそれを未完成と呼ぶ。ガリュは彼女の宮を、すでに敗れたものとして数える。種は同じ翼牙だ。羽音まで同じなので、霧の中では味方と敵が区別できない。区別がついた瞬間に、撃ち合う。流離は返還を待ち、新生は港の灯で国を始める。どちらもりゅうおうの代理ではない。
                </p>
              </div>
              <div>
                <h3 className="font-display text-base text-fg">店から見えること</h3>
                <p className="mt-1">
                  月詠本人は、昼の蛍光には降りてこない。彼女の翼が店に触れるなら夜で、欲しいものは温かい弁当より、飛ぶための缶と、月の代わりになる灯だ。半世界の主になりたいのではない。切れた航路の先で、月がもう一度ひとつの輪に戻るのを待っている。戻るまでは、氷の座を空けない。
                </p>
              </div>
              <div>
                <h3 className="font-display text-base text-fg">氷穴の秘密</h3>
                <p className="mt-1">
                  北の氷穴は、もともとあった洞窟ではない。宮が落ちたとき、途中で切れた夜の航路が氷の底で輪になって止まった。頭の上の細い月は、その輪の片側だけだ。もう片側は空にない。氷の下にある。十一の旗は、極北を凍った亡者の領地だと思っている。番をしている骨は棺の艦隊ではない。南へ飛ばなかった翼が、飛ぶことを自分でやめた姿だ。冷気の中で止まれば、宮の人数は減ったことにならない。彼らの吐く息が、穴の霧になる。
                </p>
                <p className="mt-2">
                  輪の縁からは、白い結晶が採れる。店ではそれを塩として置き、灯の底に溜まったものだと信じている。月詠は少しだけ外へ出す。残った生きた翼が、昔の航路を芯の長さで測るためだ。採りすぎれば氷が薄くなり、輪が息をする。息をすれば宮は持ち上がる。持ち上がった月を、返還待ちではない旗が先に見つけてしまう。だから彼女は座を空けない。秘密は、待っていることではない。半分の月を、まだ氷で押さえていることだ。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <TsukuyoChat />

      <section className="mx-auto mt-4 w-full max-w-5xl px-4 pb-10">
        <figure className="overflow-hidden rounded-lg border border-border bg-surface">
          <img
            key={plate.src}
            src={plate.src}
            alt={plate.title}
            className="mx-auto max-h-[72dvh] w-full object-contain"
          />
          <figcaption className="border-t border-border px-4 py-4 sm:px-6">
            <p className="text-[11px] tracking-wide text-faint">
              {String(i + 1).padStart(2, "0")} / {String(PLATES.length).padStart(2, "0")}
            </p>
            <h2 className="mt-1 font-display text-2xl text-fg">{plate.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{plate.body}</p>
          </figcaption>
        </figure>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            className="h-11 flex-1 rounded-md border border-border text-sm text-fg disabled:opacity-40"
          >
            前の葉
          </button>
          <button
            type="button"
            onClick={() => setI((n) => Math.min(PLATES.length - 1, n + 1))}
            disabled={i === PLATES.length - 1}
            className="h-11 flex-1 rounded-md bg-accent text-sm text-accent-fg disabled:opacity-40"
          >
            次の葉
          </button>
        </div>

        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PLATES.map((p, n) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={p.title}
                aria-current={n === i}
                className={n === i ? "block w-full overflow-hidden rounded-sm ring-2 ring-accent" : "block w-full overflow-hidden rounded-sm opacity-70 hover:opacity-100"}
              >
                <img src={p.src} alt="" className="aspect-[3/4] w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
