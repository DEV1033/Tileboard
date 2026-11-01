import * as THREE from 'three';
import { MAZE, VIEW } from '../config';

/** Screen-space rectangle (CSS pixels) the board should be framed inside. */
export interface Frame { x: number; y: number; w: number; h: number }

/**
 * Fixed three-quarter gameplay camera (never auto-rotates, so control directions stay intuitive).
 * Distance is recomputed on resize so the whole board — including its tilt swing and the visible
 * rim thickness — fits inside the given frame (the area between the HUD and controls, or the
 * hero's visual column), and the image is shifted so the board sits in the middle of that frame.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private target = new THREE.Vector3(0, -0.15, 0.25);

  constructor() {
    this.camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 200);
  }

  resize(width: number, height: number, frame: Frame): void {
    const cam = this.camera, aspect = width / height;
    cam.aspect = aspect;
    const vfov = THREE.MathUtils.degToRad(VIEW.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    // bounding radius of the board plus margin for tilt; a little extra on narrow frames
    const radius = MAZE.outerRadius * (frame.w / frame.h < 0.8 ? 1.07 : 0.98);
    // fit within the frame's share of each field of view
    const fracV = Math.max(0.3, frame.h / height), fracH = Math.max(0.3, frame.w / width);
    const fitV = radius / Math.sin(Math.atan(Math.tan(vfov / 2) * fracV));
    const fitH = radius / Math.sin(Math.atan(Math.tan(hfov / 2) * fracH));
    const dist = Math.max(fitV, fitH);
    const el = THREE.MathUtils.degToRad(VIEW.elevationDeg);
    cam.position.set(0, this.target.y + Math.sin(el) * dist, this.target.z + Math.cos(el) * dist);
    cam.lookAt(this.target);
    // shift the image so the board's centre lands on the frame's centre
    const dx = width / 2 - (frame.x + frame.w / 2), dy = height / 2 - (frame.y + frame.h / 2);
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) cam.setViewOffset(width, height, dx, dy, width, height); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
}
