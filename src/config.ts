/**
 * All tunable parameters live here.
 *
 * Board coordinate system (board-local, Y up):
 *   - Origin at the centre of the board, on the channel floor (y = 0).
 *   - +X is the player's right, -Z is "away from the player" (top of the reference photo).
 *   - Angles are in degrees, measured counter-clockwise when seen from above,
 *     0° = +X (right), 90° = -Z (far side), 180° = -X (left), 270° = +Z (near side).
 *     A point at angle a and radius r is (r·cos a, y, -r·sin a).
 *
 * Units: 1 unit ≈ 1.5 cm on the real object (board radius 5 ≈ 15 cm across).
 *
 * The maze was measured from the reference photograph by polar-unwrapping it around the
 * centre of the rings (see tools/unwrap.mjs and reference/unwrap.png) and normalising so that
 * the outer radius is 5.0. Radii are within roughly ±0.05 units of the photo; the exact
 * channel depth cannot be seen in the photo and is an estimate.
 */

export interface GapSpec {
  /** Centre of the opening, degrees (see convention above). */
  angleDeg: number;
  /** Width of the opening. Both cut faces are parallel to the centre line, like a saw cut. */
  width: number;
}

export interface WallSpec {
  name: string;
  innerRadius: number;
  outerRadius: number;
  gaps: GapSpec[];
}

export interface MazeConfig {
  outerRadius: number;
  baseThickness: number;
  wallHeight: number;
  rimInnerRadius: number;
  outerBevel: number;
  edgeBevel: number;
  knob: { radius: number; height: number; bevel: number };
  walls: WallSpec[];
  /** Angular size of each convex collision piece along curved walls. */
  colliderSegmentDeg: number;
}

export const MAZE: MazeConfig = {
  outerRadius: 5.0,
  baseThickness: 0.5,
  wallHeight: 0.44,
  rimInnerRadius: 4.3,
  outerBevel: 0.07,
  edgeBevel: 0.035,
  knob: { radius: 0.62, height: 0.42, bevel: 0.07 },
  // Measured: wall 1 r 118–200 px, wall 2 r 232–325 px, wall 3 r 355–452 px (outer radius 580 px).
  walls: [
    { name: 'inner', innerRadius: 1.02, outerRadius: 1.72, gaps: [{ angleDeg: 155.5, width: 0.46 }] },
    { name: 'middle', innerRadius: 2.12, outerRadius: 2.8, gaps: [{ angleDeg: 345, width: 0.46 }] },
    { name: 'outer', innerRadius: 3.2, outerRadius: 3.9, gaps: [{ angleDeg: 160.5, width: 0.46 }] }
  ],
  colliderSegmentDeg: 4
};

/** Channel i lies between the knob/wall i-1 and wall i (channel 0 hugs the knob, channel 3 is outermost). */
export function channelBounds(i: number, maze: MazeConfig = MAZE): [number, number] {
  const inner = i === 0 ? maze.knob.radius : maze.walls[i - 1].outerRadius;
  const outer = i < maze.walls.length ? maze.walls[i].innerRadius : maze.rimInnerRadius;
  return [inner, outer];
}
export const channelCenter = (i: number) => { const [a, b] = channelBounds(i); return (a + b) / 2; };

export interface BallStart { channel: number; angleDeg: number }

export const BALLS = {
  radius: 0.16,
  widthSegments: 48,
  heightSegments: 32,
  /** Free play: the positions in the reference photo (channel 2, beside the middle wall's opening). */
  freePlayStart: [
    { channel: 1, angleDeg: 356 },
    { channel: 1, angleDeg: 341 },
    { channel: 1, angleDeg: 323 }
  ] as BallStart[],
  /** Reach-the-centre and timed modes start in the outermost channel, nearest the player. */
  challengeStart: [
    { channel: 3, angleDeg: 262 },
    { channel: 3, angleDeg: 270 },
    { channel: 3, angleDeg: 278 }
  ] as BallStart[]
};

export const PHYSICS = {
  /** Board-scale gravity (units/s²). Real gravity would be ≈ 650; a lower value keeps the puzzle controllable. */
  gravity: 220,
  timestep: 1 / 120,
  maxSubSteps: 8,
  ballDensity: 7.8,
  ballFriction: 0.35,
  ballRestitution: 0.18,
  woodFriction: 0.55,
  woodRestitution: 0.2,
  linearDamping: 0.12,
  /** Acts as rolling resistance so balls come to rest on a level board. */
  angularDamping: 0.45
};

export const CONTROLS = {
  maxTiltDeg: 14,
  /** How quickly the board follows the requested tilt (1/s). */
  response: 7,
  /** How quickly it settles back to level when input is released (1/s). */
  returnResponse: 5,
  /** Default sensitivity multiplier (settings slider range 0.4–1.6). */
  sensitivity: 1,
  joystickDeadZone: 0.06,
  device: {
    /** Phone tilt (degrees from the calibrated neutral) that produces full board tilt at sensitivity 1. */
    fullTiltDeg: 20,
    deadZoneDeg: 1.5,
    /** Low-pass filter rate for sensor noise (1/s). */
    smoothing: 12
  }
};

export const VIEW = {
  fov: 30,
  /** Camera elevation above the board plane, degrees. */
  elevationDeg: 57,
  maxPixelRatio: 2,
  maxPixelRatioMobile: 1.6,
  tableY: -2.4
};

export const GAME = {
  /** Seconds all balls must stay in the centre channel to count as finished. */
  settleSec: 1.0
};