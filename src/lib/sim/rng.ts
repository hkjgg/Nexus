/**
 * Deterministic pseudo-random number generation.
 *
 * The demo data engine must be reproducible: the same seed has to produce
 * byte-identical data on every machine, so that screenshots, tests and the
 * narrated demo stories stay in sync. `Math.random` cannot give us that, so
 * everything random in `src/lib/sim` goes through this module.
 *
 * `mulberry32` is a small, fast, well-distributed 32-bit generator. It is not
 * cryptographically secure and must never be used for anything but simulation.
 */

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  /** Uniform integer in [min, max] (inclusive on both ends). */
  int(min: number, max: number): number;
  /** True with probability `p`. */
  bool(p: number): boolean;
  /** Uniformly picks one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Picks one element using positive weights parallel to `items`. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** Returns a new array shuffled with Fisher-Yates. Does not mutate input. */
  shuffle<T>(items: readonly T[]): T[];
  /** Normal deviate via Box-Muller, clamped to +/- 4 sigma. */
  normal(mean: number, stdDev: number): number;
  /** A v4-shaped UUID built from this generator, so ids are reproducible too. */
  uuid(): string;
};

/** Turns an arbitrary string into a 32-bit seed. */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const HEX = '0123456789abcdef';

export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const float = (min: number, max: number): number => min + next() * (max - min);

  const int = (min: number, max: number): number => Math.floor(float(min, max + 1));

  const rng: Rng = {
    next,
    float,
    int,
    bool: (p) => next() < p,

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick called with an empty array');
      return items[Math.floor(next() * items.length)]!;
    },

    weighted<T>(items: readonly T[], weights: readonly number[]): T {
      if (items.length === 0) throw new Error('rng.weighted called with an empty array');
      if (items.length !== weights.length) {
        throw new Error('rng.weighted: items and weights must have the same length');
      }
      let total = 0;
      for (const w of weights) total += Math.max(0, w);
      if (total <= 0) return rng.pick(items);

      let threshold = next() * total;
      for (let i = 0; i < items.length; i += 1) {
        threshold -= Math.max(0, weights[i]!);
        if (threshold <= 0) return items[i]!;
      }
      return items[items.length - 1]!;
    },

    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },

    normal(mean: number, stdDev: number): number {
      // Box-Muller needs u1 > 0 to avoid log(0).
      const u1 = 1 - next();
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + Math.max(-4, Math.min(4, z)) * stdDev;
    },

    uuid(): string {
      let out = '';
      for (let i = 0; i < 32; i += 1) {
        if (i === 12) {
          out += '4'; // version 4
        } else if (i === 16) {
          out += HEX[(Math.floor(next() * 16) & 0x3) | 0x8]!; // variant 10xx
        } else {
          out += HEX[Math.floor(next() * 16)]!;
        }
      }
      return [
        out.slice(0, 8),
        out.slice(8, 12),
        out.slice(12, 16),
        out.slice(16, 20),
        out.slice(20, 32),
      ].join('-');
    },
  };

  return rng;
}
