export type Dir = "n" | "e" | "s" | "w";
export type Act = Dir | "wait" | "potion";

export interface Mob {
  id: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  max: number;
  atk: number;
  def: number;
  gold: number;
  boss?: boolean;
}

export interface Pile {
  id: number;
  x: number;
  y: number;
  kind: "gold" | "potion";
  n: number;
}

export interface ScarState {
  floor: number;
  w: number;
  h: number;
  tiles: number[];
  seen: Uint8Array;
  visible: Uint8Array;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
  pot: number;
  mobs: Mob[];
  piles: Pile[];
  log: string[];
  over: "play" | "dead" | "clear";
  bossDown: boolean;
}

const W = 36;
const H = 22;
export const CAVE_FLOORS = 4;
export const MAX_FLOOR = 99999;

const DELTA: Record<Dir, [number, number]> = {
  n: [0, -1],
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
};

const KINDS = [
  { name: "泡", hp: 6, atk: 3, def: 0, gold: 7 },
  { name: "骨兵", hp: 8, atk: 4, def: 1, gold: 9 },
  { name: "牙", hp: 11, atk: 5, def: 1, gold: 12 },
  { name: "翼稚", hp: 9, atk: 5, def: 0, gold: 14 },
  { name: "呪鼠", hp: 7, atk: 4, def: 0, gold: 11 },
  { name: "鱗番", hp: 14, atk: 6, def: 2, gold: 18 },
  { name: "穴の手", hp: 10, atk: 4, def: 1, gold: 10 },
] as const;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idx(w: number, x: number, y: number) {
  return y * w + x;
}

function tileAt(s: ScarState, x: number, y: number) {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return 0;
  return s.tiles[idx(s.w, x, y)] ?? 0;
}

function blocked(s: ScarState, x: number, y: number, ignore = -1) {
  if (tileAt(s, x, y) === 0) return true;
  if (s.px === x && s.py === y) return true;
  return s.mobs.some((m) => m.id !== ignore && m.hp > 0 && m.x === x && m.y === y);
}

function pushLog(s: ScarState, line: string) {
  s.log = [line, ...s.log].slice(0, 8);
}

function threat(floor: number) {
  if (floor <= CAVE_FLOORS) return floor - 1;
  return 4 + Math.floor((floor - CAVE_FLOORS) ** 0.42);
}

function guardianName(floor: number) {
  if (floor === CAVE_FLOORS) return "残爪";
  if (floor === MAX_FLOOR) return "底の爪";
  if (floor >= 50 && floor % 50 === 0) return "深番";
  return "";
}

function enterLine(floor: number) {
  if (floor === 1) return "かつての勇者の洞窟。四階で終わる、と誰もが思っている。";
  if (floor < CAVE_FLOORS) return `${floor}階。まだ、勇者の洞窟だ。`;
  if (floor === CAVE_FLOORS) return "四階。洞窟の底の顔をしている。";
  if (floor === CAVE_FLOORS + 1) return "五階。ここからが本番だ。爪痕は、99999階まである。";
  if (floor === MAX_FLOOR) return "99999階。本当の底。";
  return `${floor}階。この階は、降りた今、掘られた。`;
}

function roll(rng: () => number, atk: number, def: number) {
  const base = atk - Math.floor(def / 2);
  return Math.max(1, Math.max(1, base) + Math.floor(rng() * 3) - 1);
}

function los(tiles: number[], w: number, x0: number, y0: number, x1: number, y1: number) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) return true;
    if ((tiles[idx(w, x, y)] ?? 0) === 0) return false;
  }
  return true;
}

function reveal(s: ScarState) {
  s.visible.fill(0);
  const r = 6;
  for (let y = s.py - r; y <= s.py + r; y++) {
    for (let x = s.px - r; x <= s.px + r; x++) {
      if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
      if ((x - s.px) ** 2 + (y - s.py) ** 2 > r * r) continue;
      if (!los(s.tiles, s.w, s.px, s.py, x, y)) continue;
      const i = idx(s.w, x, y);
      s.visible[i] = 1;
      s.seen[i] = 1;
    }
  }
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

function carveRoom(tiles: number[], w: number, r: Room) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) tiles[idx(w, x, y)] = 1;
  }
}

function carveHall(tiles: number[], w: number, x0: number, y0: number, x1: number, y1: number) {
  let x = x0;
  while (x !== x1) {
    tiles[idx(w, x, y0)] = tiles[idx(w, x, y0)] === 2 ? 2 : 1;
    x += x < x1 ? 1 : -1;
  }
  let y = y0;
  while (y !== y1) {
    tiles[idx(w, x1, y)] = tiles[idx(w, x1, y)] === 2 ? 2 : 1;
    y += y < y1 ? 1 : -1;
  }
  if (tiles[idx(w, x1, y1)] !== 2) tiles[idx(w, x1, y1)] = 1;
}

function overlaps(a: Room, b: Room) {
  return a.x - 1 < b.x + b.w && a.x + a.w + 1 > b.x && a.y - 1 < b.y + b.h && a.y + a.h + 1 > b.y;
}

function makeFloor(floor: number, hp: number, maxHp: number, atk: number, def: number, gold: number, pot: number, rng: () => number): ScarState {
  const tiles = new Array<number>(W * H).fill(0);
  const rooms: Room[] = [];
  for (let n = 0; n < 28 && rooms.length < 7; n++) {
    const rw = 4 + Math.floor(rng() * 4);
    const rh = 3 + Math.floor(rng() * 3);
    const room = {
      x: 1 + Math.floor(rng() * (W - rw - 2)),
      y: 1 + Math.floor(rng() * (H - rh - 2)),
      w: rw,
      h: rh,
    };
    if (rooms.some((o) => overlaps(room, o))) continue;
    rooms.push(room);
    carveRoom(tiles, W, room);
  }
  if (rooms.length < 3) return makeFloor(floor, hp, maxHp, atk, def, gold, pot, rng);
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1]!;
    const b = rooms[i]!;
    carveHall(tiles, W, a.x + (a.w >> 1), a.y + (a.h >> 1), b.x + (b.w >> 1), b.y + (b.h >> 1));
  }
  const start = rooms[0]!;
  const end = rooms[rooms.length - 1]!;
  const px = start.x + (start.w >> 1);
  const py = start.y + (start.h >> 1);
  const sx = end.x + (end.w >> 1);
  const sy = end.y + (end.h >> 1);
  tiles[idx(W, sx, sy)] = 2;

  let seq = 1;
  const mobs: Mob[] = [];
  const count = Math.min(7, floor <= CAVE_FLOORS ? 2 + floor : 4 + (floor % 3));
  const hard = threat(floor);
  for (let i = 0; i < count; i++) {
    const room = rooms[1 + Math.floor(rng() * (rooms.length - 1))]!;
    const x = room.x + Math.floor(rng() * room.w);
    const y = room.y + Math.floor(rng() * room.h);
    if (tiles[idx(W, x, y)] === 0 || (x === px && y === py) || (x === sx && y === sy)) continue;
    if (mobs.some((m) => m.x === x && m.y === y)) continue;
    const kind = KINDS[Math.floor(rng() * (floor <= 2 ? 3 : KINDS.length))]!;
    const hp = kind.hp + hard * 2;
    mobs.push({
      id: seq++,
      name: kind.name,
      x,
      y,
      hp,
      max: hp,
      atk: kind.atk + Math.floor(hard / 2),
      def: kind.def + Math.floor(hard / 6),
      gold: kind.gold + hard * 2,
    });
  }
  const guard = guardianName(floor);
  if (guard) {
    let bx = end.x + 1;
    let by = end.y + 1;
    for (let y = end.y; y < end.y + end.h; y++) {
      for (let x = end.x; x < end.x + end.w; x++) {
        if (tiles[idx(W, x, y)] === 1 && !(x === sx && y === sy)) {
          bx = x;
          by = y;
        }
      }
    }
    const ghp = 28 + hard * 3;
    mobs.push({
      id: seq++,
      name: guard,
      x: bx,
      y: by,
      hp: ghp,
      max: ghp,
      atk: 6 + Math.floor(hard / 2),
      def: 2 + Math.floor(hard / 8),
      gold: 40 + hard * 4,
      boss: true,
    });
  }

  const piles: Pile[] = [];
  const spots = rooms.slice(1);
  const pileCount = Math.min(6, floor <= CAVE_FLOORS ? 2 + floor : 4);
  for (let i = 0; i < pileCount; i++) {
    const room = spots[Math.floor(rng() * spots.length)] ?? end;
    const x = room.x + Math.floor(rng() * room.w);
    const y = room.y + Math.floor(rng() * room.h);
    if (tiles[idx(W, x, y)] !== 1) continue;
    if (mobs.some((m) => m.x === x && m.y === y)) continue;
    piles.push({
      id: seq++,
      x,
      y,
      kind: i % 3 === 0 ? "potion" : "gold",
      n: i % 3 === 0 ? 1 : 6 + hard + Math.floor(rng() * (8 + hard)),
    });
  }

  const s: ScarState = {
    floor,
    w: W,
    h: H,
    tiles,
    seen: new Uint8Array(W * H),
    visible: new Uint8Array(W * H),
    px,
    py,
    hp,
    maxHp,
    atk,
    def,
    gold,
    pot,
    mobs,
    piles,
    log: [enterLine(floor)],
    over: "play",
    bossDown: guard === "",
  };
  reveal(s);
  return s;
}

export function createScar(seed = Date.now() % 1_000_000): ScarState {
  const rng = mulberry(seed || 1);
  return makeFloor(1, 22, 22, 4, 1, 0, 1, rng);
}

function pickup(s: ScarState) {
  const here = s.piles.filter((p) => p.x === s.px && p.y === s.py);
  if (!here.length) return;
  s.piles = s.piles.filter((p) => p.x !== s.px || p.y !== s.py);
  for (const p of here) {
    if (p.kind === "gold") {
      s.gold += p.n;
      pushLog(s, `金貨 ${p.n}。`);
    } else {
      s.pot += p.n;
      pushLog(s, "薬瓶を拾った。");
    }
  }
}

function descend(s: ScarState, rng: () => number): ScarState {
  if (s.floor >= MAX_FLOOR) {
    s.over = "clear";
    pushLog(s, "99999階。本当の底だ。金は、引き上げられる。");
    return s;
  }
  const nextFloor = s.floor + 1;
  const hpUp = s.floor < CAVE_FLOORS ? 4 : 2;
  const atkUp = s.floor < CAVE_FLOORS || nextFloor % 6 === 0 ? 1 : 0;
  const next = makeFloor(
    nextFloor,
    Math.min(s.maxHp + hpUp, s.hp + hpUp + 2),
    s.maxHp + hpUp,
    s.atk + atkUp,
    s.def,
    s.gold,
    s.pot,
    rng,
  );
  const line =
    nextFloor === CAVE_FLOORS + 1
      ? "洞窟の底だと思った階段が、まだ続いていた。"
      : nextFloor <= CAVE_FLOORS
        ? `${s.floor}階を降りた。傷は少し閉じた。`
        : `${s.floor}階を降りた。この階は、今掘られた。`;
  next.log = [line, ...next.log].slice(0, 8);
  return next;
}

function stepToward(s: ScarState, m: Mob) {
  const q: [number, number][] = [[m.x, m.y]];
  const prev = new Map<number, number>();
  const start = idx(s.w, m.x, m.y);
  prev.set(start, -1);
  let found = -1;
  for (let i = 0; i < q.length && i < 160; i++) {
    const [x, y] = q[i]!;
    if (x === s.px && y === s.py) {
      found = idx(s.w, x, y);
      break;
    }
    for (const [dx, dy] of Object.values(DELTA)) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = idx(s.w, nx, ny);
      if (prev.has(ni)) continue;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      if (tileAt(s, nx, ny) === 0) continue;
      if (!(nx === s.px && ny === s.py) && s.mobs.some((o) => o.hp > 0 && o.id !== m.id && o.x === nx && o.y === ny)) continue;
      prev.set(ni, idx(s.w, x, y));
      q.push([nx, ny]);
    }
  }
  if (found < 0) return;
  let cur = found;
  let parent = prev.get(cur) ?? -1;
  while (parent !== start && parent >= 0) {
    cur = parent;
    parent = prev.get(cur) ?? -1;
  }
  if (parent !== start) return;
  const nx = cur % s.w;
  const ny = Math.floor(cur / s.w);
  if (nx === s.px && ny === s.py) return;
  m.x = nx;
  m.y = ny;
}

function monsters(s: ScarState, rng: () => number) {
  for (const m of s.mobs) {
    if (m.hp <= 0 || s.over !== "play") continue;
    const dist = Math.abs(m.x - s.px) + Math.abs(m.y - s.py);
    const see = s.visible[idx(s.w, m.x, m.y)] === 1;
    if (!see && dist > 8) continue;
    if (dist === 1) {
      const dmg = roll(rng, m.atk, s.def);
      s.hp -= dmg;
      pushLog(s, `${m.name}の爪。${dmg}。`);
      if (s.hp <= 0) {
        s.hp = 0;
        s.over = "dead";
        pushLog(s, "爪に沈んだ。");
        return;
      }
      continue;
    }
    if (see || dist < 6) stepToward(s, m);
  }
}

export function act(state: ScarState, action: Act, seed = Date.now()): ScarState {
  if (state.over !== "play") return state;
  const s = {
    ...state,
    tiles: state.tiles.slice(),
    seen: new Uint8Array(state.seen),
    visible: new Uint8Array(state.visible),
    mobs: state.mobs.map((m) => ({ ...m })),
    piles: state.piles.map((p) => ({ ...p })),
    log: state.log.slice(),
  };
  const rng = mulberry((seed ^ (s.floor * 997 + s.px * 13 + s.py)) >>> 0);

  if (action === "potion") {
    if (s.pot <= 0) {
      pushLog(s, "薬瓶は、空だ。");
      return s;
    }
    s.pot -= 1;
    const heal = Math.min(s.maxHp - s.hp, 10);
    s.hp += heal;
    pushLog(s, `薬。傷が ${heal} 閉じた。`);
  } else if (action !== "wait") {
    const [dx, dy] = DELTA[action];
    const nx = s.px + dx;
    const ny = s.py + dy;
    const foe = s.mobs.find((m) => m.hp > 0 && m.x === nx && m.y === ny);
    if (foe) {
      const dmg = roll(rng, s.atk, foe.def);
      foe.hp -= dmg;
      pushLog(s, `${foe.name}に ${dmg}。`);
      if (foe.hp <= 0) {
        s.gold += foe.gold;
        pushLog(s, `${foe.name}は沈んだ。${foe.gold}G。`);
        if (foe.boss) {
          s.bossDown = true;
          pushLog(
            s,
            s.floor === CAVE_FLOORS
              ? "残爪が折れた。洞窟は、ここで終わるはずだった。"
              : s.floor === MAX_FLOOR
                ? "底の爪が折れた。ここが、本当の底だ。"
                : "番が沈んだ。階段が開く。",
          );
        }
      }
    } else if (!blocked(s, nx, ny)) {
      s.px = nx;
      s.py = ny;
      pickup(s);
      if (tileAt(s, s.px, s.py) === 2) {
        if (!s.bossDown) {
          pushLog(s, s.floor === CAVE_FLOORS ? "残爪が、階段を踏ませない。" : "番が、階段の前にいる。");
        } else {
          return descend(s, rng);
        }
      }
    } else {
      return state;
    }
  } else {
    pushLog(s, "息を、一つ置いた。");
  }

  if (s.over === "play") monsters(s, rng);
  reveal(s);
  return s;
}

export const SCAR_FLOORS = CAVE_FLOORS;
