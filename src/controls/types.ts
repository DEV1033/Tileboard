/**
 * Normalised tilt request shared by every input adapter.
 *   x: -1 … 1, +1 = right side of the board goes down (balls roll right)
 *   z: -1 … 1, +1 = far side goes down ("forward", balls roll away from the player)
 */
export interface TiltInput { x: number; z: number }

export type ControlMode = 'keyboard' | 'mouse' | 'touch' | 'motion';

export interface TiltSource {
  readonly mode: ControlMode;
  /** True while the player is actively driving this source. */
  active(): boolean;
  read(out: TiltInput): TiltInput;
  /** Forget any held state (e.g. when switching modes or pausing). */
  reset(): void;
}

/** Clamp a tilt vector into the unit disc so diagonals are never stronger than a single axis. */
export function clampToDisc(v: TiltInput): TiltInput {
  const l = Math.hypot(v.x, v.z);
  if (l > 1) { v.x /= l; v.z /= l; }
  return v;
}
