import { DENS, DEN_IDS, FACTION_IDS, timeBand, WARLORDS } from "./data";
import type { DenId, FactionId, GameState } from "./types";

export const MAP_COLS = 80;
export const MAP_ROWS = 50;
const N = MAP_COLS * MAP_ROWS;

export const enum Terrain {
  Wild = 0,
  Marsh = 1,
  Water = 2,
  Ice = 3,
  Mountain = 4,
  Waste = 5,
  Cliff = 6,
}

export const enum Zone {
  None = 0,
  Road = 1,
  Commerce = 2,
  Settle = 3,
  Ruin = 4,
  Store = 5,
  Air = 6,
  Wall = 7,
}

const TERRAIN: Uint8Array = (() => {
  const t = new Uint8Array(N);
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      t[r * MAP_COLS + c] = pickTerrain(c, r);
    }
  }
  return t;
})();

function hash2(x: number, y: number): number {
  let n = Math.imul(x + 3, 374761393) ^ Math.imul(y + 7, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function pickTerrain(c: number, r: number): Terrain {
  const x = (c / (MAP_COLS - 1)) * 100;
  const y = (r / (MAP_ROWS - 1)) * 100;
  const n = hash2(c, r);
  if (y > 88 + n * 5) return Terrain.Water;
  if (y > 76 && x > 52 && n > 0.28) return Terrain.Water;
  if (y > 82 && x > 40) return Terrain.Water;
  if (y < 11 + n * 4) return Terrain.Ice;
  if (x < 18 && y > 28 && y < 48) return Terrain.Cliff;
  if (x < 30 && y > 44 && y < 66) return n > 0.38 ? Terrain.Marsh : Terrain.Wild;
  if (x < 34 && y < 30 && n > 0.42) return Terrain.Mountain;
  if (x > 32 && x < 46 && y < 32 && n > 0.62) return Terrain.Mountain;
  if (x > 44 && x < 64 && y > 34 && y < 52 && n > 0.22) return Terrain.Waste;
  return Terrain.Wild;
}

export function denToCell(id: DenId): { c: number; r: number } {
  const d = DENS[id];
  return {
    c: (d.x / 100) * (MAP_COLS - 1),
    r: (d.y / 100) * (MAP_ROWS - 1),
  };
}

function idx(c: number, r: number): number {
  return r * MAP_COLS + c;
}

function inBounds(c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < MAP_COLS && r < MAP_ROWS;
}

function dist2(c0: number, r0: number, c1: number, r1: number): number {
  const dc = c0 - c1;
  const dr = r0 - r1;
  return dc * dc + dr * dr;
}

function factionIndex(id: FactionId): number {
  return FACTION_IDS.indexOf(id) + 1;
}

function bresenham(
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  visit: (c: number, r: number) => void,
) {
  let x = Math.round(c0);
  let y = Math.round(r0);
  const x1 = Math.round(c1);
  const y1 = Math.round(r1);
  const dx = Math.abs(x1 - x);
  const dy = Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx - dy;
  for (let step = 0; step < 240; step++) {
    visit(x, y);
    if (x === x1 && y === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

export interface MapField {
  terrain: Uint8Array;
  zone: Uint8Array;
  faction: Uint8Array;
  glow: Float32Array;
  storeR: number;
  roads: number;
}

export function storeRadius(g: GameState): number {
  const age = g.day - 1 + g.hour / 24;
  const sprawl = 0.82 + 0.18 * Math.min(1, age / 8);
  const attracted = DEN_IDS.reduce((n, id) => n + (g.dens[id] > 0 ? 1 : 0), 0);
  const f = g.facilities;
  const raw =
    6.4 +
    f.lighting * 1.15 +
    f.register * 0.55 +
    f.atm * 0.5 +
    f.hotcase * 1.3 +
    f.delivery * 1.8 +
    f.warehouse * 0.7 +
    f.golem * 0.4 +
    f.wyvern * 0.35 +
    attracted * 1.05 +
    g.guestsToday * 0.03 +
    (g.campaign ? 1.4 : 0) -
    g.warHeat * 0.02;
  return Math.max(5.4, raw) * sprawl;
}

export function buildMapField(g: GameState): MapField {
  const zone = new Uint8Array(N);
  const faction = new Uint8Array(N);
  const glow = new Float32Array(N);
  const store = denToCell("radaan");
  const age = g.day - 1 + g.hour / 24;
  const sprawl = 0.82 + 0.18 * Math.min(1, age / 8);
  const storeR = storeRadius(g);
  const storeR2 = storeR * storeR;
  const delivery = g.facilities.delivery;
  const wyvern = g.facilities.wyvern;
  const golem = g.facilities.golem;
  const courier = g.staff.includes("courier");

  let roads = 0;

  const paint = (c: number, r: number, z: Zone, gl: number, fac = 0) => {
    if (!inBounds(c, r)) return;
    const i = idx(c, r);
    if (TERRAIN[i] === Terrain.Water && z !== Zone.Air) return;
    if (gl >= glow[i]) {
      glow[i] = gl;
      zone[i] = z;
      if (fac) faction[i] = fac;
    }
  };

  const paintRoad = (c0: number, r0: number, c1: number, r1: number, thick: number, air: boolean) => {
    bresenham(c0, r0, c1, r1, (c, r) => {
      const z = air ? Zone.Air : Zone.Road;
      for (let dc = -thick; dc <= thick; dc++) {
        const cc = c + dc;
        if (!inBounds(cc, r)) continue;
        const i = idx(cc, r);
        if (!air && TERRAIN[i] === Terrain.Water) continue;
        if (zone[i] === Zone.Store) continue;
        if (air) {
          if (glow[i] < 0.5) {
            glow[i] = 0.45;
            zone[i] = z;
          }
          continue;
        }
        if (zone[i] === Zone.Settle && glow[i] > 0.7) continue;
        glow[i] = Math.max(glow[i], 0.82);
        zone[i] = z;
        roads += 1;
      }
    });
  };

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const i = idx(c, r);
      const d2 = dist2(c, r, store.c, store.r);
      if (d2 <= storeR2) {
        const t = 1 - Math.sqrt(d2) / storeR;
        const gl = 0.35 + t * 0.7;
        if (TERRAIN[i] !== Terrain.Water) {
          glow[i] = gl;
          zone[i] = Zone.Commerce;
        }
      }
    }
  }

  for (const id of DEN_IDS) {
    const lv = g.dens[id];
    const den = DENS[id];
    if (id === "hollow" && g.caveSealed) {
      const cell = denToCell(id);
      for (let r = -3; r <= 3; r++) {
        for (let c = -3; c <= 3; c++) {
          if (c * c + r * r <= 9) {
            const cc = Math.round(cell.c + c);
            const rr = Math.round(cell.r + r);
            if (!inBounds(cc, rr)) continue;
            const i = idx(cc, rr);
            zone[i] = Zone.None;
            glow[i] = 0.05;
            faction[i] = 0;
          }
        }
      }
      continue;
    }
    if (id === "hollow" && !g.caveKnown) continue;
    if (lv <= 0 && id !== "radaan") continue;
    const cell = denToCell(id);
    const power = g.warlordPower[den.warlord];
    const boost = g.warContract === den.warlord ? 0.9 : 0;
    const denR = (2.2 + lv * 2.4 + power / 48 + boost) * (0.86 + 0.14 * sprawl);
    const denR2 = denR * denR;
    const fac = factionIndex(den.faction);
    for (let r = Math.floor(cell.r - denR - 1); r <= Math.ceil(cell.r + denR + 1); r++) {
      for (let c = Math.floor(cell.c - denR - 1); c <= Math.ceil(cell.c + denR + 1); c++) {
        if (!inBounds(c, r)) continue;
        const d2 = dist2(c, r, cell.c, cell.r);
        if (d2 > denR2) continue;
        const t = 1 - Math.sqrt(d2) / denR;
        paint(c, r, Zone.Settle, 0.4 + t * 0.65, fac);
      }
    }
  }

  for (const id of DEN_IDS) {
    const lv = g.dens[id];
    if (id === "hollow" && !g.caveKnown) continue;
    if (lv <= 0 && id !== "radaan") continue;
    const cell = denToCell(id);
    const thick = delivery > 0 || courier ? 1 : 0;
    if (id !== "radaan") {
      paintRoad(store.c, store.r, cell.c, cell.r, thick, false);
      if (wyvern > 0 && (id === "claw" || id === "tower" || id === "ice")) {
        paintRoad(store.c, store.r, cell.c, cell.r, 0, true);
      }
    }
  }

  if (golem > 0) {
    const rad = 2 + golem;
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      paint(
        Math.round(store.c + Math.cos(ang) * rad),
        Math.round(store.r + Math.sin(ang) * rad),
        Zone.Wall,
        0.7,
      );
    }
  }

  if (g.warHeat > 22) {
    const live = DEN_IDS.filter((id) => g.dens[id] > 0 && id !== "hollow");
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = DENS[live[i]];
        const b = DENS[live[j]];
        const kin = a.faction === b.faction;
        const waste = live[i] === "waste" || live[j] === "waste";
        if (!kin && !waste) continue;
        const ca = denToCell(live[i]);
        const cb = denToCell(live[j]);
        const heat = (g.warHeat / 100) * (kin ? 0.85 : 0.5);
        bresenham(ca.c, ca.r, cb.c, cb.r, (c, r) => {
          if (hash2(c + g.day, r) > 0.55) return;
          paint(c, r, Zone.Ruin, 0.35 + heat, 0);
        });
      }
    }
  }

  if (g.warHeat > 40) {
    for (let i = 0; i < N; i++) {
      if (zone[i] === Zone.Road && hash2(i, g.day) > 0.72) {
        zone[i] = Zone.Ruin;
        glow[i] = Math.max(glow[i], 0.4);
      }
    }
  }

  for (let r = Math.floor(store.r - 2); r <= Math.ceil(store.r + 2); r++) {
    for (let c = Math.floor(store.c - 2); c <= Math.ceil(store.c + 2); c++) {
      if (!inBounds(c, r)) continue;
      if (dist2(c, r, store.c, store.r) <= 1.7) {
        const i = idx(c, r);
        zone[i] = Zone.Store;
        glow[i] = 1;
      }
    }
  }

  return { terrain: TERRAIN, zone, faction, glow, storeR, roads };
}

export const FACTION_RGB: Record<FactionId, [number, number, number]> = {
  gelum: [126, 200, 192],
  yokuga: [122, 147, 175],
  gabing: [181, 122, 92],
  kottou: [138, 143, 122],
  rinkou: [196, 161, 92],
  jumon: [139, 155, 180],
  cave: [196, 180, 154],
};

export const TERRAIN_RGB: Record<Terrain, [number, number, number]> = {
  [Terrain.Wild]: [58, 78, 68],
  [Terrain.Marsh]: [46, 118, 82],
  [Terrain.Water]: [52, 96, 158],
  [Terrain.Ice]: [148, 176, 196],
  [Terrain.Mountain]: [132, 108, 86],
  [Terrain.Waste]: [156, 96, 62],
  [Terrain.Cliff]: [96, 84, 76],
};

export function cellColor(
  field: MapField,
  i: number,
  hour: number,
  pulse: number,
  selectedGlow: number,
): [number, number, number, number] {
  const band = timeBand(hour);
  const night = band === "night" || band === "late" ? 0.78 : band === "dusk" ? 0.88 : band === "dawn" ? 0.92 : 1;
  const t = field.terrain[i];
  const z = field.zone[i];
  const g = field.glow[i];
  let [r, gch, b] = TERRAIN_RGB[t as Terrain];
  let a = night;

  if (z === Zone.None && g < 0.08) {
    return [r, gch, b, 0.96];
  }

  if (z === Zone.Commerce) {
    r = 140;
    gch = 224;
    b = 214;
    a = (0.55 + g * 0.45) * (band === "night" || band === "late" ? 1.08 : 0.95);
  } else if (z === Zone.Store) {
    const blink = 0.82 + pulse * 0.18;
    r = 244;
    gch = 240;
    b = 228;
    a = blink;
  } else if (z === Zone.Road) {
    r = 232;
    gch = 210;
    b = 160;
    a = 0.72 + g * 0.28;
  } else if (z === Zone.Air) {
    r = 190;
    gch = 214;
    b = 236;
    a = 0.4 + pulse * 0.16;
  } else if (z === Zone.Wall) {
    r = 120;
    gch = 128;
    b = 140;
    a = 0.82;
  } else if (z === Zone.Ruin) {
    r = 210;
    gch = 86;
    b = 86;
    a = 0.5 + g * 0.4;
  } else if (z === Zone.Settle) {
    const fi = field.faction[i];
    const id = FACTION_IDS[fi - 1];
    if (id) {
      [r, gch, b] = FACTION_RGB[id];
      const nocturnal = id === "yokuga" || id === "kottou" || id === "cave";
      a = (0.62 + g * 0.38) * (nocturnal && (band === "night" || band === "late") ? 1.12 : Math.max(night, 0.85));
    }
  } else {
    a *= 0.85;
  }

  if (selectedGlow > 0) {
    a = Math.min(1, a + selectedGlow * 0.35);
    r = Math.min(255, r + selectedGlow * 40);
    gch = Math.min(255, gch + selectedGlow * 30);
  }

  return [r, gch, b, Math.min(1, a)];
}

export function nearestDen(c: number, r: number, g: GameState): DenId | null {
  let best: DenId | null = null;
  let bestD = 7.5;
  for (const id of DEN_IDS) {
    if (id === "hollow" && !g.caveKnown) {
      const cell = denToCell(id);
      const d = Math.hypot(c - cell.c, r - cell.r);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
      continue;
    }
    const cell = denToCell(id);
    const d = Math.hypot(c - cell.c, r - cell.r);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}
