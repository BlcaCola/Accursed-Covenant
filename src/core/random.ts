/** Seeded PRNG: reproducible rooms, loot and encounters; no dependence on frame-rate. */
export class Random {
  constructor(private state: number) { this.state = state >>> 0; }
  next(): number {
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  pick<T>(values: readonly T[]): T { return values[this.int(0, values.length - 1)]; }
  shuffle<T>(values: readonly T[]): T[] {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) { const j = this.int(0, i); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
}
export const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
/** Domain values shown to players are rounded once at their calculation boundary. */
export const round2=(value:number):number=>Math.round((value+Number.EPSILON)*100)/100;
export const fixed2=(value:number):string=>round2(value).toFixed(2);
