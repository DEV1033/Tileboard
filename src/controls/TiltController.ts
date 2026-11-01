import * as THREE from 'three';
import { CONTROLS } from '../config';
import { clampToDisc, type TiltInput } from './types';

/**
 * Turns a normalised tilt request into a smoothed board orientation.
 * Frame-rate independent exponential smoothing gives the board a little weight: it eases towards
 * the request while input is held and settles back to level (a bit more slowly) when released.
 *
 * Axis convention (board-local, see config.ts):
 *   right tilt  (x > 0): rotate about +Z by a negative angle → +X edge goes down → balls roll to +X
 *   forward tilt (z > 0): rotate about +X by a negative angle → far (-Z) edge goes down → balls roll to -Z
 */
export class TiltController {
  sensitivity = CONTROLS.sensitivity;
  maxTiltDeg = CONTROLS.maxTiltDeg;
  readonly current = { x: 0, z: 0 };
  readonly quaternion = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'XZY');
  private req: TiltInput = { x: 0, z: 0 };

  update(input: TiltInput, dt: number, applySensitivity = true): THREE.Quaternion {
    const s = applySensitivity ? this.sensitivity : 1;
    this.req.x = input.x * s; this.req.z = input.z * s; clampToDisc(this.req);
    const releasing = Math.hypot(this.req.x, this.req.z) < Math.hypot(this.current.x, this.current.z);
    const k = 1 - Math.exp(-(releasing ? CONTROLS.returnResponse : CONTROLS.response) * dt);
    this.current.x += (this.req.x - this.current.x) * k;
    this.current.z += (this.req.z - this.current.z) * k;
    const max = THREE.MathUtils.degToRad(this.maxTiltDeg);
    this.euler.set(-this.current.z * max, 0, -this.current.x * max);
    return this.quaternion.setFromEuler(this.euler);
  }

  reset(): void { this.current.x = 0; this.current.z = 0; this.quaternion.identity(); }
}
