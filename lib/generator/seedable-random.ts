/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 *
 * Ensures 100% reproducible synthetic financial data generation
 * across runs given the same initial numeric seed.
 */
export class SeedableRandom {
  private s: number;

  constructor(seed: number = 2026) {
    this.s = Math.floor(seed);
  }

  /**
   * Return a pseudo-random float in range [0, 1)
   */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Return a pseudo-random integer in range [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Return a pseudo-random BigInt in range [min, max] inclusive
   */
  nextBigInt(min: bigint, max: bigint): bigint {
    const range = max - min + 1n;
    const factor = BigInt(Math.floor(this.next() * 1000000));
    return min + (range * factor) / 1000000n;
  }

  /**
   * Pick an item from an array
   */
  pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Returns true with probability p (0 <= p <= 1)
   */
  boolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
}
