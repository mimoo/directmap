// Small seeded RNG (mulberry32) so drills are reproducible and testable.

export type Rng = () => number

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, minIncl: number, maxExcl: number): number {
  return minIncl + Math.floor(rng() * (maxExcl - minIncl))
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick from empty array')
  return arr[randInt(rng, 0, arr.length)]
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
