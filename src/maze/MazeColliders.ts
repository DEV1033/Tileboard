import type RAPIER_NS from '@dimforge/rapier3d-compat';
import type { MazeConfig } from '../config';
import { PHYSICS } from '../config';
import { pieceAngle, wallPieces, type WallPiece } from './MazeGeometry';

type Rapier = typeof RAPIER_NS;

/**
 * Static colliders for the board, all attached to ONE fixed rigid body (a compound collider):
 *  - floor: a single flat cylinder (smooth, no triangle seams for the balls to catch on)
 *  - knob: a cylinder
 *  - every curved wall and the outer rim: small convex hulls (annular-sector prisms) generated from
 *    the same WallPiece description as the rendered geometry, so visible and physical walls match.
 */
export function buildMazeColliders(R: Rapier, world: RAPIER_NS.World, m: MazeConfig): number {
  const body = world.createRigidBody(R.RigidBodyDesc.fixed());
  let count = 0;
  const wood = (d: RAPIER_NS.ColliderDesc) => { world.createCollider(d.setFriction(PHYSICS.woodFriction).setRestitution(PHYSICS.woodRestitution), body); count++; };

  wood(R.ColliderDesc.cylinder(m.baseThickness / 2, m.outerRadius).setTranslation(0, -m.baseThickness / 2, 0));
  wood(R.ColliderDesc.cylinder((m.knob.height + 0.05) / 2, m.knob.radius).setTranslation(0, (m.knob.height - 0.05) / 2, 0));

  const top = m.wallHeight, bottom = -0.05;
  const addPiece = (p: WallPiece) => {
    const span = Math.abs(pieceAngle(p, p.outerRadius, 1) - pieceAngle(p, p.outerRadius, 0)) * 180 / Math.PI;
    const n = Math.max(1, Math.ceil(span / m.colliderSegmentDeg));
    for (let k = 0; k < n; k++) {
      const pts: number[] = [];
      for (const t of [k / n, (k + 1) / n]) for (const r of [p.innerRadius, p.outerRadius]) {
        const a = pieceAngle(p, r, t), x = r * Math.cos(a), z = -r * Math.sin(a);
        pts.push(x, bottom, z, x, top, z);
      }
      const desc = R.ColliderDesc.convexHull(new Float32Array(pts));
      if (desc) wood(desc);
    }
  };
  m.walls.forEach(w => wallPieces(w).forEach(addPiece));
  // Outer rim (full ring, extends past the edge so nothing can squeeze out)
  addPiece({ innerRadius: m.rimInnerRadius, outerRadius: m.outerRadius + 0.2, startGap: 0, startHalf: 0, endGap: Math.PI * 2, endHalf: 0, full: true });
  return count;
}
