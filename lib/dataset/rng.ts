/** Seeded random helpers. Everything the generator produces is a pure function of the seed. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
export const between = (r: Rng, lo: number, hi: number) => lo + r() * (hi - lo);
export const int = (r: Rng, lo: number, hi: number) => Math.round(between(r, lo, hi));
export const pick = <T,>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
export const chance = (r: Rng, p: number) => r() < p;

/** Standard normal via Box-Muller. */
export function normal(r: Rng, mean = 0, sd = 1) {
  const u = Math.max(r(), 1e-12);
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export function weighted<T>(r: Rng, items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = r() * total;
  for (const item of items) {
    x -= item.weight;
    if (x <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

/** Small-mean Poisson sample (Knuth). */
export function poisson(r: Rng, mean: number) {
  const limit = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > limit);
  return k - 1;
}

export function shuffle<T>(r: Rng, xs: readonly T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Stable small hash of a string to a number in [0,1). */
export function hash01(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
