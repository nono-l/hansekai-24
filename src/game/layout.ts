import { FACILITIES, MAX_SHELF_LOG, PRODUCT_IDS, PRODUCTS } from "./data";
import type { FacilityId, Fixture, FixtureKind, GameState, ProductId, ShelfLogReason, StaffId } from "./types";

export const FLOOR_W = 14;
export const FLOOR_H = 10;

export type CatalogId =
  | "register"
  | "hotcase"
  | "atm"
  | "lamp"
  | "golem"
  | "hatch"
  | "perch"
  | "crate"
  | `shelf-${ProductId}`;

export interface CatalogItem {
  id: CatalogId;
  kind: FixtureKind;
  product?: ProductId;
  facility?: FacilityId;
  name: string;
  blurb: string;
  cost: number;
}

export const CATALOG: CatalogItem[] = [
  { id: "shelf-onigiri", kind: "shelf", product: "onigiri", name: "塩むすび棚", blurb: "最も安い兵糧の列。", cost: 60 },
  { id: "shelf-bento", kind: "shelf", product: "bento", name: "弁当棚", blurb: "昼の隊列が止まる。", cost: 70 },
  { id: "shelf-mpcan", kind: "shelf", product: "mpcan", name: "MP缶冷蔵", blurb: "夜の翼の棚。", cost: 80 },
  { id: "shelf-chicken", kind: "hotcase", product: "chicken", facility: "hotcase", name: "ホットケース", blurb: "りゅうおうチキン。", cost: FACILITIES.hotcase.costs[0]! },
  { id: "shelf-oil", kind: "shelf", product: "oil", name: "刃油棚", blurb: "戦争の潤滑。", cost: 90 },
  { id: "shelf-salt", kind: "shelf", product: "salt", name: "呪い塩棚", blurb: "亡者と書記官。", cost: 85 },
  { id: "shelf-lantern", kind: "shelf", product: "lantern", name: "夜行灯棚", blurb: "霧夜の目。", cost: 75 },
  { id: "shelf-map", kind: "shelf", product: "map", name: "地図棚", blurb: "兵站の眼。", cost: 95 },
  { id: "shelf-wine", kind: "shelf", product: "wine", name: "鱗酒棚", blurb: "侯爵の喉。", cost: 110 },
  { id: "register", kind: "register", facility: "register", name: "レジ", blurb: "会計の歯。列が短いほど不興は減る。", cost: FACILITIES.register.costs[0]! },
  { id: "atm", kind: "atm", facility: "atm", name: "金貨換機", blurb: "鱗侯が溶かす。", cost: FACILITIES.atm.costs[0]! },
  { id: "lamp", kind: "lamp", facility: "lighting", name: "蛍光灯", blurb: "天井の灯。通路は塞がない。", cost: FACILITIES.lighting.costs[0]! },
  { id: "golem", kind: "golem", facility: "golem", name: "ゴーレム台", blurb: "石の店員。", cost: FACILITIES.golem.costs[0]! },
  { id: "hatch", kind: "hatch", facility: "delivery", name: "納品口", blurb: "遠い巣穴も客になる。", cost: FACILITIES.delivery.costs[0]! },
  { id: "perch", kind: "perch", facility: "wyvern", name: "竜用駐機", blurb: "屋根ではなく、店の角に降りる。", cost: FACILITIES.wyvern.costs[0]! },
  { id: "crate", kind: "crate", facility: "warehouse", name: "倉庫箱", blurb: "在庫の上限が伸びる。", cost: FACILITIES.warehouse.costs[0]! },
];

export const KIND_TO_FACILITY: Partial<Record<FixtureKind, FacilityId>> = {
  register: "register",
  hotcase: "hotcase",
  lamp: "lighting",
  atm: "atm",
  golem: "golem",
  hatch: "delivery",
  perch: "wyvern",
  crate: "warehouse",
};

export function isDoor(x: number, y: number): boolean {
  return y === FLOOR_H - 1 && (x === 6 || x === 7);
}

export function isWall(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= FLOOR_W || y >= FLOOR_H) return true;
  if (isDoor(x, y)) return false;
  return x === 0 || y === 0 || x === FLOOR_W - 1 || y === FLOOR_H - 1;
}

export function blocksWalk(kind: FixtureKind): boolean {
  return kind !== "lamp";
}

export function fixtureAt(layout: Fixture[], x: number, y: number): Fixture | undefined {
  return layout.find((f) => f.x === x && f.y === y);
}

export function isWalkable(g: GameState, x: number, y: number): boolean {
  if (isWall(x, y) && !isDoor(x, y)) return false;
  if (x < 0 || y < 0 || x >= FLOOR_W || y >= FLOOR_H) return false;
  const f = fixtureAt(g.layout, x, y);
  if (f && blocksWalk(f.kind)) return false;
  return true;
}

export function countKind(layout: Fixture[], kind: FixtureKind): number {
  return layout.filter((f) => f.kind === kind).length;
}

export function countProductShelf(layout: Fixture[], product: ProductId): number {
  return layout.filter((f) => (f.kind === "shelf" || f.kind === "hotcase") && f.product === product).length;
}

export function isGondola(f: Fixture): f is Fixture & { product: ProductId } {
  return (f.kind === "shelf" || f.kind === "hotcase") && Boolean(f.product);
}

export function defaultCap(kind: FixtureKind): number {
  return kind === "hotcase" ? 12 : 20;
}

export function withShelfStock(f: Fixture): Fixture {
  if (!isGondola(f)) return f;
  const capacity = f.capacity ?? defaultCap(f.kind);
  const stock = f.stock ?? 0;
  const reorderBelow = f.reorderBelow ?? Math.min(6, Math.max(0, Math.floor(capacity * 0.3)));
  return { ...f, capacity, stock: Math.min(stock, capacity), reorderBelow: Math.min(reorderBelow, capacity) };
}

export function gondolas(g: GameState, product?: ProductId): Fixture[] {
  return g.layout.filter((f) => isGondola(f) && (product == null || f.product === product));
}

export function faceStock(g: GameState, product: ProductId): number {
  return gondolas(g, product).reduce((s, f) => s + (f.stock ?? 0), 0);
}

export function faceCap(g: GameState, product: ProductId): number {
  return gondolas(g, product).reduce((s, f) => s + (f.capacity ?? defaultCap(f.kind)), 0);
}

export function onHand(g: GameState, product: ProductId): number {
  return g.inventory[product] + faceStock(g, product);
}

export function totalOnHand(g: GameState): number {
  return PRODUCT_IDS.reduce((s, id) => s + onHand(g, id), 0);
}

export function takeFromShelves(
  g: GameState,
  product: ProductId,
  n: number,
  reason: ShelfLogReason = "event",
  who?: string,
  preferUid?: number,
): number {
  let left = n;
  const list = gondolas(g, product).sort((a, b) => {
    if (preferUid != null) {
      if (a.uid === preferUid) return -1;
      if (b.uid === preferUid) return 1;
    }
    return (b.stock ?? 0) - (a.stock ?? 0);
  });
  for (const f of list) {
    if (left <= 0) break;
    const take = Math.min(left, f.stock ?? 0);
    f.stock = (f.stock ?? 0) - take;
    left -= take;
    if (take > 0) pushShelfLog(g, f, -take, reason, who);
  }
  return n - left;
}

export function putOnShelves(g: GameState, product: ProductId, n: number, reason: ShelfLogReason = "order"): number {
  let left = n;
  const list = gondolas(g, product).sort((a, b) => {
    const ra = (a.stock ?? 0) / Math.max(1, a.capacity ?? defaultCap(a.kind));
    const rb = (b.stock ?? 0) / Math.max(1, b.capacity ?? defaultCap(b.kind));
    return ra - rb;
  });
  for (const f of list) {
    if (left <= 0) break;
    const cap = f.capacity ?? defaultCap(f.kind);
    const space = Math.max(0, cap - (f.stock ?? 0));
    const put = Math.min(left, space);
    f.stock = (f.stock ?? 0) + put;
    left -= put;
    if (put > 0) pushShelfLog(g, f, put, reason);
  }
  return left;
}

export function takeProduct(
  g: GameState,
  product: ProductId,
  n: number,
  reason: ShelfLogReason = "event",
  who?: string,
  preferUid?: number,
): number {
  let left = n;
  left -= takeFromShelves(g, product, left, reason, who, preferUid);
  const w = Math.min(left, g.inventory[product]);
  g.inventory[product] -= w;
  left -= w;
  return n - left;
}

export function clearProduct(g: GameState, product: ProductId) {
  g.inventory[product] = 0;
  for (const f of gondolas(g, product)) {
    const had = f.stock ?? 0;
    if (had > 0) {
      f.stock = 0;
      pushShelfLog(g, f, -had, "clear");
    }
  }
}

export function restockFromWarehouse(g: GameState, maxUnits: number, who?: string): number {
  let left = maxUnits;
  let moved = 0;
  while (left > 0) {
    let best: Fixture | null = null;
    let bestNeed = 0;
    for (const f of gondolas(g)) {
      if (!f.product) continue;
      const cap = f.capacity ?? defaultCap(f.kind);
      const need = Math.max(0, cap - (f.stock ?? 0));
      if (need <= 0 || g.inventory[f.product] <= 0) continue;
      const ratio = (f.stock ?? 0) / cap;
      const score = need + (1 - ratio) * 4;
      if (score > bestNeed) {
        bestNeed = score;
        best = f;
      }
    }
    if (!best?.product) break;
    const cap = best.capacity ?? defaultCap(best.kind);
    const space = Math.max(0, cap - (best.stock ?? 0));
    const put = Math.min(left, space, g.inventory[best.product]);
    if (put <= 0) break;
    best.stock = (best.stock ?? 0) + put;
    g.inventory[best.product] -= put;
    left -= put;
    moved += put;
    pushShelfLog(g, best, put, "restock", who);
  }
  return moved;
}

export function pourWarehouseToShelves(g: GameState) {
  for (const id of PRODUCT_IDS) {
    g.inventory[id] = putOnShelves(g, id, g.inventory[id], "restock");
  }
}

export function pushShelfLog(
  g: GameState,
  f: Fixture,
  delta: number,
  reason: ShelfLogReason,
  who?: string,
) {
  if (!delta || !f.product) return;
  g.logSeq = (g.logSeq ?? 0) + 1;
  if (!g.shelfLogs) g.shelfLogs = [];
  g.shelfLogs.unshift({
    id: g.logSeq,
    uid: f.uid,
    day: g.day,
    hour: g.hour,
    product: f.product,
    delta,
    after: f.stock ?? 0,
    reason,
    who,
  });
  if (g.shelfLogs.length > MAX_SHELF_LOG) g.shelfLogs.length = MAX_SHELF_LOG;
}

export function hydrateGondolas(g: GameState) {
  g.layout = g.layout.map(withShelfStock);
}

export function syncFacilities(g: GameState) {
  g.facilities.register = countKind(g.layout, "register");
  g.facilities.hotcase = countKind(g.layout, "hotcase");
  g.facilities.lighting = countKind(g.layout, "lamp");
  g.facilities.atm = countKind(g.layout, "atm");
  g.facilities.golem = countKind(g.layout, "golem");
  g.facilities.delivery = countKind(g.layout, "hatch");
  g.facilities.wyvern = countKind(g.layout, "perch");
  g.facilities.warehouse = countKind(g.layout, "crate");
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function bfs(
  g: GameState,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] | null {
  if (from.x === to.x && from.y === to.y) return [from];
  const key = (x: number, y: number) => y * FLOOR_W + x;
  const seen = new Uint8Array(FLOOR_W * FLOOR_H);
  const prev = new Int16Array(FLOOR_W * FLOOR_H).fill(-1);
  const qx = [from.x];
  const qy = [from.y];
  seen[key(from.x, from.y)] = 1;
  let qi = 0;
  while (qi < qx.length) {
    const x = qx[qi]!;
    const y = qy[qi]!;
    qi += 1;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWalkable(g, nx, ny) && !(nx === to.x && ny === to.y && fixtureAt(g.layout, nx, ny))) continue;
      if (nx === to.x && ny === to.y) {
        const path = [{ x: nx, y: ny }];
        let cx = x;
        let cy = y;
        while (cx !== from.x || cy !== from.y) {
          path.push({ x: cx, y: cy });
          const p = prev[key(cx, cy)]!;
          cx = p % FLOOR_W;
          cy = (p / FLOOR_W) | 0;
        }
        path.push(from);
        path.reverse();
        return path;
      }
      const k = key(nx, ny);
      if (seen[k] || !isWalkable(g, nx, ny)) continue;
      seen[k] = 1;
      prev[k] = key(x, y);
      qx.push(nx);
      qy.push(ny);
    }
  }
  return null;
}

export function doorTiles(): { x: number; y: number }[] {
  return [
    { x: 6, y: FLOOR_H - 1 },
    { x: 7, y: FLOOR_H - 1 },
  ];
}

export function nearestOf(
  layout: Fixture[],
  pred: (f: Fixture) => boolean,
  from: { x: number; y: number },
): Fixture | null {
  let best: Fixture | null = null;
  let bestD = 1e9;
  for (const f of layout) {
    if (!pred(f)) continue;
    const d = Math.abs(f.x - from.x) + Math.abs(f.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

export function approachTile(g: GameState, t: { x: number; y: number }): { x: number; y: number } {
  for (const [dx, dy] of DIRS) {
    const nx = t.x + dx;
    const ny = t.y + dy;
    if (isWalkable(g, nx, ny)) return { x: nx, y: ny };
  }
  return t;
}

const FACE_DIR: Record<0 | 1 | 2 | 3, [number, number]> = {
  0: [0, 1],
  1: [1, 0],
  2: [0, -1],
  3: [-1, 0],
};

export function faceTile(g: GameState, f: Fixture): { x: number; y: number } {
  const [dx, dy] = FACE_DIR[f.rot];
  const nx = f.x + dx;
  const ny = f.y + dy;
  if (isWalkable(g, nx, ny)) return { x: nx, y: ny };
  return approachTile(g, { x: f.x, y: f.y });
}

export function guestRoute(g: GameState, want: ProductId): {
  path: { x: number; y: number }[];
  shelfAt: number;
  regAt: number;
} {
  const door = doorTiles()[0]!;
  const shelf =
    nearestOf(g.layout, (f) => (f.kind === "shelf" || f.kind === "hotcase") && f.product === want, door) ??
    nearestOf(g.layout, (f) => f.kind === "shelf" || f.kind === "hotcase", door);
  const reg = nearestOf(g.layout, (f) => f.kind === "register", door);
  const pts: { x: number; y: number }[] = [door];
  const pushPath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const p = bfs(g, a, b);
    if (!p) return a;
    for (let i = 1; i < p.length; i++) pts.push(p[i]!);
    return b;
  };
  let cur = door;
  let shelfAt = 0;
  let regAt = -1;
  if (shelf) {
    cur = pushPath(cur, faceTile(g, shelf));
    shelfAt = Math.max(0, pts.length - 1);
  }
  if (reg) {
    const face = faceTile(g, reg);
    const at = pts[pts.length - 1]!;
    if (at.x === face.x && at.y === face.y) {
      const detour = { x: Math.min(FLOOR_W - 2, face.x + 1), y: face.y };
      if (isWalkable(g, detour.x, detour.y) && (detour.x !== face.x || detour.y !== face.y)) {
        pts.push(detour);
      }
      pts.push(face);
    } else {
      cur = pushPath(cur, face);
    }
    cur = pts[pts.length - 1]!;
    regAt = pts.length - 1;
  }
  let x = Math.round(cur.x);
  let y = Math.round(cur.y);
  while (y < door.y) {
    const ny = y + 1;
    if (isWalkable(g, x, ny) || isDoor(x, ny)) {
      y = ny;
      cur = { x, y };
      pts.push(cur);
    } else break;
  }
  if (cur.x !== door.x || cur.y !== door.y) {
    const rest = bfs(g, cur, door);
    if (rest) {
      for (let i = 1; i < rest.length; i++) pts.push(rest[i]!);
    } else pts.push(door);
  }
  pts.push({ x: door.x, y: FLOOR_H - 0.1 });
  pts.push({ x: door.x, y: FLOOR_H + 0.55 });
  pts.push({ x: door.x, y: FLOOR_H + 1.55 });
  if (pts.length <= 3) {
    return {
      path: [door, { x: 6, y: FLOOR_H - 3 }, door, { x: door.x, y: FLOOR_H + 1.55 }],
      shelfAt: 1,
      regAt: 1,
    };
  }
  if (regAt < 0) regAt = Math.max(1, pts.length - 4);
  return { path: pts, shelfAt, regAt };
}

export function hasRegisterPath(g: GameState): boolean {
  const door = doorTiles()[0]!;
  const reg = nearestOf(g.layout, (f) => f.kind === "register", door);
  if (!reg) return false;
  return Boolean(bfs(g, door, faceTile(g, reg)));
}

const SLOT: Record<FixtureKind, [number, number][]> = {
  register: [
    [10, 2],
    [10, 4],
    [10, 6],
    [11, 3],
  ],
  hotcase: [
    [8, 2],
    [8, 4],
  ],
  lamp: [
    [4, 1],
    [7, 1],
    [10, 1],
    [4, 8],
  ],
  atm: [
    [12, 2],
    [12, 4],
  ],
  golem: [
    [2, 2],
    [2, 4],
    [2, 6],
    [12, 6],
  ],
  hatch: [
    [1, 5],
    [1, 6],
  ],
  perch: [
    [12, 7],
    [11, 7],
  ],
  crate: [
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 7],
  ],
  shelf: [
    [3, 3],
    [5, 3],
    [3, 5],
    [5, 5],
    [3, 7],
    [5, 7],
    [7, 3],
    [7, 5],
    [7, 7],
    [9, 5],
    [9, 7],
    [4, 4],
  ],
};

export function firstFreeSlot(g: GameState, kind: FixtureKind): { x: number; y: number } | null {
  const slots = SLOT[kind] ?? SLOT.shelf;
  for (const [x, y] of slots) {
    if (isWall(x, y) || isDoor(x, y)) continue;
    if (!fixtureAt(g.layout, x, y)) return { x, y };
  }
  for (let y = 1; y < FLOOR_H - 1; y++) {
    for (let x = 1; x < FLOOR_W - 1; x++) {
      if (isDoor(x, y) || isWall(x, y)) continue;
      if (!fixtureAt(g.layout, x, y)) return { x, y };
    }
  }
  return null;
}

export function starterLayout(): { layout: Fixture[]; layoutUid: number } {
  const layout: Fixture[] = [
    { uid: 1, kind: "register", x: 10, y: 3, rot: 0 },
    { uid: 2, kind: "shelf", x: 3, y: 3, rot: 0, product: "onigiri", capacity: 24, stock: 18, reorderBelow: 6 },
    { uid: 3, kind: "shelf", x: 5, y: 3, rot: 0, product: "bento", capacity: 20, stock: 8, reorderBelow: 5 },
    { uid: 4, kind: "shelf", x: 3, y: 5, rot: 0, product: "lantern", capacity: 16, stock: 4, reorderBelow: 4 },
    { uid: 5, kind: "lamp", x: 7, y: 2, rot: 0 },
  ];
  return { layout, layoutUid: 6 };
}

export function layoutFromFacilities(g: GameState): { layout: Fixture[]; layoutUid: number } {
  const hasAny = Object.values(g.facilities).some((n) => n > 0);
  if (!hasAny) return starterLayout();
  const layout: Fixture[] = [];
  let uid = 1;
  const placeN = (kind: FixtureKind, n: number, product?: ProductId) => {
    for (let i = 0; i < n; i++) {
      const fake = { ...g, layout };
      const slot = firstFreeSlot(fake, kind);
      if (!slot) break;
      layout.push(withShelfStock({ uid: uid++, kind, x: slot.x, y: slot.y, rot: 0, product }));
    }
  };
  placeN("register", Math.max(1, g.facilities.register));
  placeN("hotcase", g.facilities.hotcase, "chicken");
  placeN("lamp", Math.max(1, g.facilities.lighting));
  placeN("atm", g.facilities.atm);
  placeN("golem", g.facilities.golem);
  placeN("hatch", g.facilities.delivery);
  placeN("perch", g.facilities.wyvern);
  placeN("crate", g.facilities.warehouse);
  placeN("shelf", 1, "onigiri");
  placeN("shelf", 1, "bento");
  return { layout, layoutUid: uid };
}

export function catalogById(id: CatalogId): CatalogItem | undefined {
  return CATALOG.find((c) => c.id === id);
}

export function shelfLabel(product: ProductId): string {
  return PRODUCTS[product].name;
}

export const PRODUCT_ICON: Record<ProductId, string> = Object.fromEntries(
  PRODUCT_IDS.map((id) => [id, PRODUCTS[id].icon]),
) as Record<ProductId, string>;

function walkSpot(g: GameState, t: { x: number; y: number }): { x: number; y: number } {
  if (isWalkable(g, t.x, t.y)) return t;
  return approachTile(g, t);
}

function faceOf(g: GameState, pred: (f: Fixture) => boolean, fallback: { x: number; y: number }): { x: number; y: number } {
  const f = nearestOf(g.layout, pred, fallback);
  return f ? faceTile(g, f) : walkSpot(g, fallback);
}

export function staffHome(g: GameState, id: StaffId): { x: number; y: number } {
  const door = doorTiles()[0]!;
  if (id === "clerk") return faceOf(g, (f) => f.kind === "register", { x: 8, y: 4 });
  if (id === "stocker") return faceOf(g, (f) => f.kind === "crate" || isGondola(f), { x: 3, y: 5 });
  if (id === "courier") return faceOf(g, (f) => f.kind === "hatch", { x: 4, y: 8 });
  if (id === "guard") return walkSpot(g, { x: 6, y: 8 });
  if (id === "night") return faceOf(g, (f) => f.kind === "lamp", { x: 10, y: 5 });
  if (id === "host") return faceOf(g, (f) => f.product === "wine", { x: 10, y: 3 });
  if (id === "scribe") return faceOf(g, (f) => f.kind === "atm" || f.kind === "register", { x: 9, y: 4 });
  return walkSpot(g, { x: 7, y: 8 });
}

export function staffAlt(g: GameState, id: StaffId): { x: number; y: number } {
  const door = doorTiles()[1] ?? doorTiles()[0]!;
  const empty = gondolas(g)
    .slice()
    .sort((a, b) => (a.stock ?? 0) / Math.max(1, a.capacity ?? 1) - (b.stock ?? 0) / Math.max(1, b.capacity ?? 1))[0];
  if (id === "clerk") return empty ? faceTile(g, empty) : staffHome(g, id);
  if (id === "stocker") return empty ? faceTile(g, empty) : staffHome(g, id);
  if (id === "courier") return walkSpot(g, door);
  if (id === "guard") return walkSpot(g, { x: 7, y: 8 });
  if (id === "night") return faceOf(g, (f) => f.kind === "crate" || f.kind === "lamp", { x: 4, y: 3 });
  if (id === "host") return faceOf(g, (f) => f.kind === "register", { x: 8, y: 4 });
  if (id === "scribe") return faceOf(g, (f) => f.kind === "register", { x: 8, y: 4 });
  return faceOf(g, (f) => f.kind === "crate", { x: 3, y: 6 });
}

export function staffDuty(id: StaffId, hour: number): string {
  const night = hour < 6 || hour >= 19;
  if (id === "clerk") return night ? "夜のレジを手伝っている" : "レジの横で列を見ている";
  if (id === "stocker") return "倉庫から棚へ運んでいる";
  if (id === "courier") return "納品口で便を待っている";
  if (id === "guard") return "入口を見張っている";
  if (id === "night") return night ? "灯を見回っている" : "休憩の隅にいる";
  if (id === "host") return "鱗酒をすすめている";
  if (id === "scribe") return "帳簿を付けている";
  return "洞の客を待っている";
}

export function staffWander(g: GameState, id: StaffId, from: { x: number; y: number }, hour: number): { x: number; y: number }[] {
  const dest = hour % 2 === 0 ? staffHome(g, id) : staffAlt(g, id);
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const path = bfs(g, start, dest);
  return path && path.length > 0 ? path : [start];
}
