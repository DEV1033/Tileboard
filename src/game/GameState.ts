import { BALLS, GAME, MAZE, type BallStart } from '../config';

export type Outcome = 'none' | 'won';

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Game rules: get every ball into the centre channel. The clock counts up from Start, with no limit. */
export class GameState {
  started = false;
  paused = false;
  elapsed = 0;
  inCentre = 0;
  outcome: Outcome = 'none';
  private settle = 0;

  starts(): BallStart[] { return BALLS.challengeStart; }

  restart(): void { this.elapsed = 0; this.inCentre = 0; this.outcome = 'none'; this.settle = 0; }

  /** Advance the clock and evaluate the finish condition. Returns a new outcome when it changes. */
  update(dt: number, ballRadii: number[]): Outcome | null {
    if (!this.started || this.paused || this.outcome !== 'none') return null;
    this.elapsed += dt;
    const centreR = MAZE.walls[0].innerRadius;
    this.inCentre = ballRadii.filter(r => r < centreR).length;
    if (this.inCentre === ballRadii.length) { this.settle += dt; if (this.settle >= GAME.settleSec) return (this.outcome = 'won'); }
    else this.settle = 0;
    return null;
  }
}
