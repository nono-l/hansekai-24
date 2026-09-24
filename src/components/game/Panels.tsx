import { useEffect, useState } from "react";
import { AUTO_ORDER_RATE, CAMPAIGNS, FACILITIES, FACTIONS, FEAT_IDS, PRODUCTS, PRODUCT_IDS, STAFF, WARLORDS, WARLORD_IDS, isPenniless, nextDeliveryHour, scrapPrice, stockCap, totalStock, warlordArt } from "@/game/data";
import { PATRONS, patronSpriteFilter } from "@/game/patrons";
import { CATALOG, faceCap, faceStock, gondolas } from "@/game/layout";
import { facilityCap, nextBuildCost } from "@/game/sim";
import { useGame } from "@/game/store";
import type { FacilityId, PatronId, ProductId, StaffId, WarlordId } from "@/game/types";
import { cn } from "@/lib/cn";

export function StockPanel() {
  const game = useGame((s) => s.game);
  const order = useGame((s) => s.order);
  const setPolicy = useGame((s) => s.setShelfPolicy);
  if (!game) return null;
  const cap = stockCap(game.facilities.warehouse);
  const used = totalStock(game.inventory);
  const next = nextDeliveryHour(game.hour);
  const scrapN = PRODUCT_IDS.reduce((s, id) => s + (game.scrap?.[id] ?? 0), 0);
  return (
    <div className="space-y-3">
      <Header
        title="棚"
        sub={`倉庫 ${used}/${cap} · 見切り ${scrapN} · 次便 ${String(next).padStart(2, "0")}:00 · 定期便は原価の${Math.round((1 - AUTO_ORDER_RATE) * 10)}割引き`}
      />
      <p className="text-xs text-muted">
        即納は定価。賞味が切れる分は見切り箱へ落ち、定価の四割で売る。財布の薄い常連がそれを買って育つ。
        {game.staff.includes("stocker")
          ? " 倉庫係が、毎時倉庫から棚へ運んでいる。"
          : " 倉庫係を雇えば、便を待たずに倉庫から棚へ補充する。"}
      </p>
      <ul className="grid grid-cols-1 gap-2">
        {PRODUCT_IDS.map((id) => {
          const p = PRODUCTS[id];
          const locked = Boolean(p.needs && game.facilities[p.needs] <= 0);
          const shelves = gondolas(game, id);
          const shelfCost = CATALOG.find((c) => c.product === id)?.cost ?? Number.POSITIVE_INFINITY;
          const buyShelf = shelves.length === 0 && game.gold >= shelfCost;
          const face = faceStock(game, id);
          const fcap = faceCap(game, id);
          const truck = Math.max(1, Math.round(p.cost * AUTO_ORDER_RATE));
          return (
            <li
              key={id}
              className={cn(
                "rounded-md border p-2.5",
                buyShelf ? "border-2 border-warn bg-warn/35" : "border-border bg-elevated",
              )}
            >
              <div className="flex items-center gap-3">
                <img src={p.icon} alt="" className="size-12 object-contain" crossOrigin="anonymous" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-fg">{p.name}</p>
                  <p className="text-xs tabular-nums text-faint">
                    棚 {face}/{fcap || "—"} · 倉庫 {game.inventory[id]} · 見切り {game.scrap?.[id] ?? 0}（{scrapPrice(id)}G） · 定価 {p.cost}G / 便 {truck}G
                  </p>
                </div>
                <Qty id={id} disabled={locked} onOrder={order} />
              </div>
              {shelves.length === 0 ? (
                <p className="mt-2 text-xs text-muted">改装で棚を置け。倉庫にあっても、棚に出なければ売れない。</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {shelves.map((f, i) => (
                    <li key={f.uid} className="flex flex-wrap items-center gap-2 rounded-sm bg-surface px-2 py-1.5">
                      <span className="text-xs text-muted">棚{i + 1}</span>
                      <span className="text-xs tabular-nums text-fg">
                        {f.stock}/{f.capacity}
                      </span>
                      <label className="ml-auto flex items-center gap-1 text-xs text-muted">
                        容量
                        <Step
                          value={f.capacity ?? 20}
                          min={8}
                          max={48}
                          step={4}
                          onChange={(n) => setPolicy(f.uid, { capacity: n })}
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs text-muted">
                        {f.reorderBelow ? `${f.reorderBelow}個以下で満タン` : "自動オフ"}
                        <Step
                          value={f.reorderBelow ?? 0}
                          min={0}
                          max={f.capacity ?? 20}
                          step={1}
                          onChange={(n) => setPolicy(f.uid, { reorderBelow: n })}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Step({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        className="size-11 rounded-sm border border-border text-fg"
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <span className="w-6 text-center text-xs tabular-nums text-fg">{value}</span>
      <button
        type="button"
        className="size-11 rounded-sm border border-border text-fg"
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </span>
  );
}

function Qty({
  id,
  disabled,
  onOrder,
}: {
  id: ProductId;
  disabled: boolean;
  onOrder: (id: ProductId, n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOrder(id, 10)}
        className="h-9 rounded-sm border border-border px-2 text-xs text-fg disabled:opacity-40"
      >
        +10 即
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOrder(id, 30)}
        className="h-9 rounded-sm border border-border px-2 text-xs text-muted disabled:opacity-40"
      >
        +30 即
      </button>
    </div>
  );
}

export function PeoplePanel() {
  const game = useGame((s) => s.game);
  const hire = useGame((s) => s.hire);
  const fire = useGame((s) => s.fire);
  const build = useGame((s) => s.build);
  const campaign = useGame((s) => s.campaign);
  const retire = useGame((s) => s.retire);
  if (!game) return null;
  const staffIds = Object.keys(STAFF) as StaffId[];
  const facIds = Object.keys(FACILITIES) as FacilityId[];

  return (
    <div className="space-y-6">
      <section>
        <Header title="店員" sub="賃金は日没に引かれる" />
        <ul className="mt-2 space-y-2">
          {staffIds
            .filter((id) => id !== "hermit" || game.caveKnown)
            .map((id) => {
            const s = STAFF[id];
            const hired = game.staff.includes(id);
            const sealed = id === "hermit" && game.caveSealed;
            return (
              <li key={id} className="rounded-md border border-border bg-elevated p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-fg">{s.name}</p>
                    <p className="text-xs text-muted">{sealed ? "注進のあと、穴は空だ。" : s.blurb}</p>
                    <p className="mt-1 text-xs tabular-nums text-faint">
                      雇用 {s.hire}G · 日給 {s.wage}G
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={sealed && !hired}
                    onClick={() => (hired ? fire(id) : hire(id))}
                    className={cn(
                      "h-11 shrink-0 rounded-sm px-3 text-sm disabled:opacity-40",
                      hired ? "border border-border text-muted" : "bg-accent text-accent-fg",
                    )}
                  >
                    {hired ? "解雇" : sealed ? "空穴" : "雇う"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <Regulars />
      <section>
        <Header title="設備" sub="店内の改装でも置ける" />
        <ul className="mt-2 space-y-2">
          {facIds.map((id) => {
            const f = FACILITIES[id];
            const lv = game.facilities[id];
            const cap = facilityCap(game, id);
            const maxed = lv >= cap;
            const cost = maxed ? 0 : nextBuildCost(game, id);
            return (
              <li key={id} className="rounded-md border border-border bg-elevated p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-fg">
                      {f.name}
                      <span className="ml-2 text-xs text-faint tabular-nums">
                        {lv}/{cap}
                      </span>
                    </p>
                    <p className="text-xs text-muted">{f.blurb}</p>
                  </div>
                  <button
                    type="button"
                    disabled={maxed || game.gold < cost}
                    onClick={() => build(id)}
                    className="h-11 shrink-0 rounded-sm bg-accent px-3 text-sm text-accent-fg disabled:opacity-40"
                  >
                    {maxed ? "完了" : `${cost}G`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <Header title="施策" />
        <ul className="mt-2 space-y-2">
          {(["leaflet", "sale", "tribute"] as const).map((id) => {
            const c = CAMPAIGNS[id];
            const active = game.campaign === id;
            return (
              <li key={id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-elevated p-3">
                <div>
                  <p className="text-sm text-fg">{c.name}</p>
                  <p className="text-xs text-muted">{c.blurb}</p>
                </div>
                <button
                  type="button"
                  disabled={active || game.gold < c.cost}
                  onClick={() => campaign(id)}
                  className="h-11 shrink-0 rounded-sm bg-accent px-3 text-sm text-accent-fg disabled:opacity-40"
                >
                  {active ? "実施中" : `${c.cost}G`}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {game.era === "endless" ? (
        <section>
          <Header title="歴史" sub="やりこみは、閉じるまで続く" />
          <button
            type="button"
            onClick={retire}
            className="mt-2 h-11 w-full rounded-md border border-border text-sm text-muted"
          >
            今の店で結末を記録する
          </button>
        </section>
      ) : null}
    </div>
  );
}

export function CourtPanel() {
  const game = useGame((s) => s.game);
  const gift = useGame((s) => s.gift);
  const contract = useGame((s) => s.contract);
  const uncontract = useGame((s) => s.uncontract);
  const [art, setArt] = useState<WarlordId | null>(null);
  if (!game) return null;
  const contracted = game.warContract ? WARLORDS[game.warContract] : null;
  return (
    <div className="space-y-3">
      <Header
        title="内乱"
        sub={
          contracted
            ? contracted.family === "cave"
              ? "匿い中：灰将レヴァン"
              : `兵站：${contracted.name} · ${contracted.leader}`
            : game.era === "endless"
              ? `やりこみ · 覇業 ${FEAT_IDS.filter((id) => game.feats[id]).length}/${FEAT_IDS.length}`
              : "中立 · 十一の旗"
        }
      />
      <p className="text-sm leading-relaxed text-muted">
        {game.caveKnown && !game.caveSealed
          ? "手土産はネームドを温める。同じ種の他旗は怒るかも。兵站は内乱の勝敗を傾ける。アイコンで立ち絵。"
          : "人族のゆうしゃが半分を渡した日から、ネームドが同時に内乱を始めた。種は六。旗は十一。アイコンで立ち絵。"}
      </p>
      {game.caveSealed ? (
        <p className="rounded-md border border-danger/40 bg-elevated px-3 py-2 text-xs leading-relaxed text-danger">
          ダンジョンは注進された。灰将レヴァンは、もう地上に出ない。
        </p>
      ) : null}
      <ul className="space-y-2">
        {WARLORD_IDS.map((id) => (
          <WarlordRow
            key={id}
            id={id}
            rep={game.warlordRep[id]}
            power={game.warlordPower[id]}
            contracted={game.warContract === id}
            sealed={id === "revan" && game.caveSealed}
            unknown={id === "revan" && !game.caveKnown}
            onGift={() => gift(id)}
            onContract={() => contract(id)}
            onBreak={uncontract}
            onOpen={() => setArt(id)}
          />
        ))}
      </ul>
      {art ? <PortraitView id={art} onClose={() => setArt(null)} /> : null}
    </div>
  );
}

function WarlordRow({
  id,
  rep,
  power,
  contracted,
  sealed,
  unknown,
  onGift,
  onContract,
  onBreak,
  onOpen,
}: {
  id: WarlordId;
  rep: number;
  power: number;
  contracted: boolean;
  sealed?: boolean;
  unknown?: boolean;
  onGift: () => void;
  onContract: () => void;
  onBreak: () => void;
  onOpen: () => void;
}) {
  const w = WARLORDS[id];
  const cave = id === "revan";
  return (
    <li className="rounded-md border border-border bg-elevated p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${w.leader}の立ち絵`}
          className="shrink-0 rounded-sm hover:bg-surface"
        >
          <img src={w.sprite} alt="" className="h-16 w-12 object-contain" crossOrigin="anonymous" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg">
            {w.leader}
            <span className="ml-2 text-[11px] text-faint">
              {w.name} · {FACTIONS[w.family].short}
            </span>
          </p>
          <p className="text-xs text-muted">
            {unknown ? "まだ穴の中。立ち絵だけは、ここから見られる。" : sealed ? "注進のあと、穴は空だ。" : w.blurb}
          </p>
          <div className="mt-2 space-y-1">
            <Meter label="関係" value={rep} />
            <Meter label={cave ? "残数" : "戦力"} value={power} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={sealed || unknown}
          onClick={onGift}
          className="h-11 flex-1 rounded-sm border border-border text-sm text-fg disabled:opacity-40"
        >
          手土産 110G
        </button>
        {contracted ? (
          <button
            type="button"
            onClick={onBreak}
            className="h-11 flex-1 rounded-sm border border-danger text-sm text-danger"
          >
            {cave ? "庇護を切る" : "契約破棄"}
          </button>
        ) : (
          <button
            type="button"
            disabled={sealed || unknown}
            onClick={onContract}
            className="h-11 flex-1 rounded-sm bg-accent text-sm text-accent-fg disabled:opacity-40"
          >
            {cave ? "匿う" : "兵站契約"}
          </button>
        )}
      </div>
    </li>
  );
}

function PortraitView({ id, onClose }: { id: WarlordId; onClose: () => void }) {
  const w = WARLORDS[id];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-bg/80" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="portrait-title"
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col gap-3 overflow-y-auto overscroll-contain sm:flex-row sm:items-end sm:justify-center sm:overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="sticky top-0 z-10 ml-auto h-11 shrink-0 rounded-md border border-border bg-surface px-4 text-sm text-fg sm:hidden"
        >
          閉じる
        </button>
        <div className="flex max-h-[46dvh] w-full items-center justify-center sm:h-[72vh] sm:max-h-[78dvh] sm:max-w-[52vw]">
          <img
            src={warlordArt(id)}
            alt=""
            className="max-h-[46dvh] max-w-full object-contain sm:max-h-full"
            crossOrigin="anonymous"
          />
        </div>
        <div className="w-full shrink-0 rounded-lg border border-border bg-surface p-4 sm:mb-6 sm:w-64">
          <p className="text-[11px] tracking-wide text-accent">
            {w.name} · {w.title}
          </p>
          <h2 id="portrait-title" className="font-display text-2xl text-fg">
            {w.leader}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{w.blurb}</p>
          <p className="mt-2 text-xs text-faint">{FACTIONS[w.family].name}</p>
          {id === "tsukuyo" ? (
            <a href="/tsukuyo" className="mt-3 inline-block text-sm text-accent hover:underline">
              月詠写真集を開く
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 h-11 w-full rounded-md border border-border text-sm text-fg"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function Regulars() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const rows = Object.entries(game.patrons)
    .flatMap(([id, m]) => {
      const kind = PATRONS[id as PatronId];
      const lv = m.level ?? 1;
      if (!kind || lv < 2) return [];
      return [{ id, m, kind, lv }];
    })
    .sort((a, b) => b.lv - a.lv || b.m.spent - a.m.spent)
    .slice(0, 8);
  return (
    <section>
      <Header title="常連" sub="無銭でも通えば成り上がる。段が上がると、その種の旗が少し厚い" />
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">まだ二段の客はいない。通えば、胃袋が旗を傾ける。</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
              <img
                src={FACTIONS[r.kind.faction].sprite}
                alt=""
                className="size-8 object-contain"
                style={{ filter: patronSpriteFilter(r.kind.hue) }}
                crossOrigin="anonymous"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">
                  {r.m.nickname ?? r.kind.name}
                  <span className="ml-2 text-[11px] text-faint">
                    {FACTIONS[r.kind.faction].short} · {r.lv}段
                    {isPenniless(r.kind.purse) && r.lv >= 3 ? " · 成り上がり" : ""}
                  </span>
                </p>
                <p className="text-[11px] tabular-nums text-muted">経験 {Math.round(r.m.spent)}G · 来店 {r.m.visits}回</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-[10px] text-faint">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
        <div className="h-full bg-accent" style={{ width: `${Math.round(value)}%` }} />
      </div>
      <span className="w-7 text-right text-[10px] tabular-nums text-muted">{Math.round(value)}</span>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h2 className="font-display text-lg text-fg">{title}</h2>
      {sub ? <p className="text-xs text-faint">{sub}</p> : null}
    </div>
  );
}
