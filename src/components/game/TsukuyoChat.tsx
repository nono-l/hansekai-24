import { WAIT_ACT, WAIT_WHERE } from "@/components/game/tsukuyoWait";
import { askTsukuyo } from "@/lib/tsukuyo-chat";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

type Line = { role: "user" | "assistant"; content: string };

const SEED: Line = {
  role: "assistant",
  content: "店主。氷の上から、見えている。聞きたいなら、短く。",
};

const PROMPTS = ["客はどうやって来る", "最初の日、何をすればいい", "氷穴を誘致するとどうなる"];
const KEY = "hansekai24-tsukuyo-chat";
const SCAR_KEY = "hansekai24-scar";

function hearsPoverty(text: string) {
  return /金が足|金が無|金がな|お金がな|お金が足|所持金|無銭|破産|金欠|カネがな|買えない|払えない|一文無|貧乏/.test(text);
}

function scarOpen() {
  try {
    return localStorage.getItem(SCAR_KEY) === "1";
  } catch {
    return false;
  }
}

function loadLines(): Line[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [SEED];
    const parsed = JSON.parse(raw) as Line[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [SEED];
    return parsed.slice(-20);
  } catch {
    return [SEED];
  }
}

function WaitBeat() {
  const [pair, setPair] = useState(() => [0, 1]);
  useEffect(() => {
    const id = window.setInterval(() => {
      setPair((prev) => {
        let a = prev[0] ?? 0;
        let b = prev[1] ?? 0;
        for (let n = 0; n < 8; n++) {
          a = Math.floor(Math.random() * WAIT_ACT.length);
          b = Math.floor(Math.random() * WAIT_WHERE.length);
          if (a !== prev[0] || b !== prev[1]) break;
        }
        return [a, b];
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  const a = pair[0] ?? 0;
  const b = pair[1] ?? 0;
  const moon = (a * 17 + b * 13) % 8;
  const breath = 28 + ((a * 5 + b * 3) % 62);
  return (
    <div className="mr-8" aria-live="off">
      <span className="mb-1 block text-[11px] tracking-wide text-accent">月詠</span>
      <div className="relative h-14 overflow-hidden rounded-md border border-border/80 bg-bg">
        <span
          className="absolute top-2 size-3 rounded-full border border-accent/80"
          style={{ left: `${8 + moon * 8}%`, boxShadow: "inset -5px 0 0 #8fd0d8" }}
        />
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="absolute size-1 rounded-full bg-accent/70"
            style={{
              left: `${(a * 11 + i * 13) % 88}%`,
              top: `${18 + ((b * 7 + i * 19) % 62)}%`,
              opacity: 0.25 + ((a + i) % 5) * 0.12,
            }}
          />
        ))}
        <span
          className="absolute bottom-2 left-3 h-1 rounded-full bg-accent/50"
          style={{ width: `${breath}%` }}
        />
      </div>
      <p key={`${a}-${b}`} className="mt-2 text-sm leading-relaxed text-muted motion-safe:animate-pulse">
        {WAIT_ACT[a]}。{WAIT_WHERE[b]}。
      </p>
    </div>
  );
}

export function TsukuyoChat() {
  const [lines, setLines] = useState<Line[]>([SEED]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [scar, setScar] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const ready = useRef(false);

  useEffect(() => {
    setLines(loadLines());
    setScar(scarOpen());
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(lines.slice(-20)));
    } catch {
      // private mode
    }
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines, busy]);

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || busy) return;
    if (hearsPoverty(content)) {
      try {
        localStorage.setItem(SCAR_KEY, "1");
      } catch {
        // private mode
      }
      setScar(true);
    }
    const next = [...lines, { role: "user" as const, content }];
    setLines(next);
    setText("");
    setErr("");
    setBusy(true);
    try {
      const res = await askTsukuyo({ data: { messages: next.slice(-8) } });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setLines((cur) => [...cur, { role: "assistant", content: res.text }]);
    } catch {
      setErr("いまは月が暗い。あとでもう一度。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="talk" className="mx-auto mt-4 w-full max-w-5xl px-4">
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <p className="text-[11px] tracking-[0.22em] text-accent">流離宮 · 声</p>
        <h2 className="font-display text-xl text-fg">月詠に聞く</h2>
        <p className="mt-1 text-xs text-muted">攻略も、宮のことも。彼女は店主として答える。送信したときだけ声が通る。</p>
        <div ref={box} className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
          {lines.map((line, n) => (
            <p
              key={`${n}-${line.role}`}
              className={
                line.role === "user"
                  ? "ml-8 rounded-md bg-elevated px-3 py-2 text-sm leading-relaxed text-fg"
                  : "mr-8 text-sm leading-relaxed text-muted"
              }
            >
              {line.role === "assistant" ? <span className="mb-1 block text-[11px] tracking-wide text-accent">月詠</span> : null}
              {line.content}
            </p>
          ))}
          {busy ? <WaitBeat /> : null}
        </div>
        {err ? <p className="mt-3 text-xs text-warn">{err}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => void send(p)}
              className="h-9 rounded-full border border-border px-3 text-xs text-muted hover:text-fg disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={400}
            placeholder="短く、聞け"
            aria-label="月詠への言葉"
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="h-11 shrink-0 rounded-md bg-accent px-4 text-sm text-accent-fg disabled:opacity-40"
          >
            送る
          </button>
        </form>
        {scar ? (
          <Link
            to="/scar"
            className="mt-3 flex h-11 items-center justify-center rounded-md border border-accent text-sm text-accent"
          >
            魔王の爪痕へ降りる
          </Link>
        ) : null}
      </div>
    </section>
  );
}
