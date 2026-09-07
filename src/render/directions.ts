import type { Vec } from '../core/types';
/** Authored direction numbers: N, NE, E, SE, S, SW, W, NW. */
export function directionFrame(facing: Vec): number {
  const sx = facing.x - facing.y, sy = (facing.x + facing.y) * .5;
  const oldSouthClockwise=(Math.round(Math.atan2(sx, sy)/(Math.PI/4))+8)%8;
  return (4-oldSouthClockwise+8)%8;
}
