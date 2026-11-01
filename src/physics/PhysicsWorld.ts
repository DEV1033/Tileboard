import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { BALLS, MAZE, PHYSICS, channelCenter, type BallStart } from '../config';
import { buildMazeColliders } from '../maze/MazeColliders';

export interface BallState {
  body: RAPIER.RigidBody;
  prevPos: THREE.Vector3; currPos: THREE.Vector3;
  prevRot: THREE.Quaternion; currRot: THREE.Quaternion;
}

/**
 * The board's colliders never move. Tilting the board is modelled by rotating gravity into the
 * board's local frame (g_local = inverse(boardRotation) · g_world), which is exactly equivalent for
 * the balls and avoids the instability of sweeping a large static compound collider every step.
 * The renderer applies the same rotation to the visual board group (balls are its children), so
 * what you see and what is simulated stay in sync.
 */
export class PhysicsWorld {
  world!: RAPIER.World;
  balls: BallState[] = [];
  colliderCount = 0;
  private gWorld = new THREE.Vector3(0, -PHYSICS.gravity, 0);
  private tmpQ = new THREE.Quaternion();
  private gLocal = new THREE.Vector3();

  static async init(): Promise<void> { await RAPIER.init(); }

  constructor(starts: BallStart[]) {
    this.world = new RAPIER.World({ x: 0, y: -PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.timestep;
    this.colliderCount = buildMazeColliders(RAPIER, this.world, MAZE);
    this.setBallCount(starts);
  }

  static startPosition(s: BallStart, out = new THREE.Vector3()): THREE.Vector3 {
    const a = s.angleDeg * Math.PI / 180, r = channelCenter(s.channel);
    return out.set(r * Math.cos(a), BALLS.radius + 0.002, -r * Math.sin(a));
  }

  /** (Re)creates ball bodies only when the count changes; otherwise just resets them. */
  setBallCount(starts: BallStart[]): void {
    while (this.balls.length > starts.length) this.world.removeRigidBody(this.balls.pop()!.body);
    while (this.balls.length < starts.length) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setCcdEnabled(true).setCanSleep(false)
        .setLinearDamping(PHYSICS.linearDamping).setAngularDamping(PHYSICS.angularDamping));
      this.world.createCollider(RAPIER.ColliderDesc.ball(BALLS.radius)
        .setDensity(PHYSICS.ballDensity).setFriction(PHYSICS.ballFriction).setRestitution(PHYSICS.ballRestitution), body);
      this.balls.push({ body, prevPos: new THREE.Vector3(), currPos: new THREE.Vector3(), prevRot: new THREE.Quaternion(), currRot: new THREE.Quaternion() });
    }
    this.reset(starts);
  }

  /** Restores positions and clears all motion through the physics engine (no scene rebuild). */
  reset(starts: BallStart[]): void {
    this.balls.forEach((b, i) => this.placeBall(b, starts[i]));
  }

  placeBall(b: BallState, s: BallStart): void {
    const p = PhysicsWorld.startPosition(s);
    b.body.setTranslation(p, true); b.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    b.body.setLinvel({ x: 0, y: 0, z: 0 }, true); b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.currPos.copy(p); b.prevPos.copy(p); b.currRot.identity(); b.prevRot.identity();
  }

  /** Gravity in the board frame for the given visual board orientation. */
  setBoardRotation(q: THREE.Quaternion): void {
    this.gLocal.copy(this.gWorld).applyQuaternion(this.tmpQ.copy(q).invert());
    this.world.gravity = { x: this.gLocal.x, y: this.gLocal.y, z: this.gLocal.z };
  }

  step(): void {
    for (const b of this.balls) { b.prevPos.copy(b.currPos); b.prevRot.copy(b.currRot); }
    this.world.step();
    for (const b of this.balls) {
      const t = b.body.translation(), r = b.body.rotation();
      b.currPos.set(t.x, t.y, t.z); b.currRot.set(r.x, r.y, r.z, r.w);
    }
  }

  /** True if a ball has left the playable area (should never happen in normal play). */
  escaped(b: BallState): boolean {
    const p = b.currPos;
    return p.y < -0.6 || p.y > 2.5 || Math.hypot(p.x, p.z) > MAZE.rimInnerRadius + 0.05 || !Number.isFinite(p.x);
  }

  dispose(): void { this.world.free(); this.balls = []; }
}
