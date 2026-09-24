export function xorshift(state: number): { value: number; next: number } {
  let x = state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  x = x >>> 0;
  return { value: x / 4294967296, next: x || 0x9e3779b9 };
}

export function rand(state: { rng: number }): number {
  const r = xorshift(state.rng);
  state.rng = r.next;
  return r.value;
}

export function randInt(state: { rng: number }, min: number, max: number): number {
  return min + Math.floor(rand(state) * (max - min + 1));
}

export function pick<T>(state: { rng: number }, list: T[]): T {
  return list[Math.floor(rand(state) * list.length)]!;
}

export function poisson(state: { rng: number }, lambda: number): number {
  const lam = Math.max(0, lambda);
  if (lam === 0) return 0;
  if (lam > 40) return Math.round(lam);
  const L = Math.exp(-lam);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rand(state);
  } while (p > L);
  return k - 1;
}
