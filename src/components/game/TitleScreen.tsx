import { useEffect } from "react";
import { BookOpen, Play, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, INTRO_LINES, SPRITE } from "@/game/data";
import { hydrateSaveFlag, useGame } from "@/game/store";
import { BUILD_STAMP } from "@/lib/build";
import { SettingsSheet } from "./Settings";

export function TitleScreen() {
  const saved = useGame((s) => s.saved);
  const ui = useGame((s) => s.ui);
  const startNew = useGame((s) => s.startNew);
  const continueSave = useGame((s) => s.continueSave);
  const setHowTo = useGame((s) => s.setHowTo);
  const setSettings = useGame((s) => s.setSettings);
  const setConfirmNew = useGame((s) => s.setConfirmNew);

  useEffect(() => {
    hydrateSaveFlag();
  }, []);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      <img
        src={SPRITE.title}
        alt=""
        className="absolute inset-0 size-full object-cover"
        crossOrigin="anonymous"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/25" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-end px-5 pb-10 pt-16 sm:pb-14">
        <p className="rise-in text-sm tracking-[0.28em] text-accent">アレスガルド・灰都ラダーン</p>
        <h1 className="mt-2 font-display text-5xl font-semibold leading-tight tracking-tight text-fg sm:text-6xl">
          {APP_NAME}
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
          人族のゆうしゃは、世界の半分を渡した。平和は来なかった。
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-faint">
          各種のネームドが同時に旗を上げた。同じ種でも、旗が違えば敵だ。
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          {saved ? (
            <Button size="lg" onClick={continueSave} className="min-h-12">
              <Play className="size-4" />
              続きから
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={saved ? "secondary" : "primary"}
            onClick={() => (saved ? setConfirmNew(true) : startNew())}
            className="min-h-12"
          >
            <RotateCcw className="size-4" />
            新しく開店
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setHowTo(true)} className="min-h-12">
            <BookOpen className="size-4" />
            手引き
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setSettings(true)} className="min-h-12">
            <Settings className="size-4" />
            設定
          </Button>
        </div>
        {BUILD_STAMP ? (
          <p className="mt-6 font-display text-xs tabular-nums tracking-wide text-faint">
            ビルド {BUILD_STAMP}
          </p>
        ) : null}
      </div>

      {ui.howTo ? <HowTo onClose={() => setHowTo(false)} /> : null}
      {ui.settings ? <SettingsSheet /> : null}
      {ui.confirmNew ? (
        <Confirm
          title="新しい店を開きますか"
          body="現在の半世界は上書きされます。"
          confirm="開店する"
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => {
            setConfirmNew(false);
            startNew();
          }}
        />
      ) : null}
    </main>
  );
}

export function IntroCrawl() {
  const finishIntro = useGame((s) => s.finishIntro);
  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg">
      <img
        src={SPRITE.title}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-40"
        crossOrigin="anonymous"
      />
      <div className="absolute inset-0 bg-bg/70" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
        <ol className="space-y-5">
          {INTRO_LINES.map((line, i) => (
            <li
              key={line}
              className="rise-in font-display text-lg leading-relaxed text-fg sm:text-xl"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {line}
            </li>
          ))}
        </ol>
        <Button className="mt-10 self-start min-h-12" onClick={finishIntro}>
          シャッターを開ける
        </Button>
      </div>
    </main>
  );
}

function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button className="absolute inset-0 bg-bg/70" aria-label="閉じる" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="howto-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 id="howto-title" className="font-display text-2xl text-fg">
          手引き
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <li>お前は人族のゆうしゃだ。剣は棚の奥。りゅうおうの部下ではない。</li>
          <li>雇った店員は店内を歩く。タップできる。倉庫係が載せた数は、棚の履歴に名前が残る。</li>
          <li>地図はドットマトリクス。店の灯と誘致が、荒野を兵站図に塗り替える。</li>
          <li>ジェルム・翼牙・牙兵・骨灯・鱗侯・呪紋。種は六。旗は十一。同じ種でも内乱する。</li>
          <li>人間はダンジョンに逃げ込んだ。西の「気配」は灰将レヴァン。灯を渡せば客。注進すれば空になる。</li>
          <li>品切れは不興。襲撃は警備と戦争熱で決まる。</li>
          <li>ネームドと兵站契約すれば、その旗の勝ち筋が傾く。匿う道もある。</li>
          <li>無銭の常連も通えば成り上がる。見切りから段がつき、財布の底が上がって高い棚へ手が伸びる。</li>
          <li>巻物のボタンで日誌をコピーできる。LLMに貼れば、この店の小説になる。</li>
          <li>人族のゆうしゃの店を、りゅうおうは片目で測っている。黙認を失うな。三十六日、灯を守れ。</li>
        </ul>
        <Button className="mt-6 w-full min-h-11" onClick={onClose}>
          閉じる
        </Button>
      </div>
    </div>
  );
}

function Confirm({
  title,
  body,
  confirm,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-bg/70" aria-label="やめる" onClick={onCancel} />
      <div role="dialog" className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-xl text-fg">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1 min-h-11" onClick={onCancel}>
            やめる
          </Button>
          <Button className="flex-1 min-h-11" onClick={onConfirm}>
            {confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
