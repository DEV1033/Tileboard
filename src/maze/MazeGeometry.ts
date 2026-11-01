import * as THREE from 'three';
import type { MazeConfig, WallSpec } from '../config';

const DEG = Math.PI / 180;

/**
 * One continuous run of a curved wall between two openings.
 * Each opening is a slot with parallel faces (a straight saw cut), so the angle at which a
 * wall piece ends depends on the radius: angle = gapCentre ± asin(halfWidth / r).
 */
export interface WallPiece {
  innerRadius: number;
  outerRadius: number;
  startGap: number; // radians, centre of the opening this piece starts after
  startHalf: number;
  endGap: number; // radians (> startGap), centre of the opening this piece ends at
  endHalf: number;
  full: boolean; // closed ring without openings
}

export function wallPieces(spec: WallSpec): WallPiece[] {
  const base = { innerRadius: spec.innerRadius, outerRadius: spec.outerRadius };
  if (!spec.gaps.length) return [{ ...base, startGap: 0, startHalf: 0, endGap: Math.PI * 2, endHalf: 0, full: true }];
  const gaps = [...spec.gaps].map(g => ({ a: g.angleDeg * DEG, h: g.width / 2 })).sort((p, q) => p.a - q.a);
  return gaps.map((g, i) => {
    const next = gaps[(i + 1) % gaps.length];
    const endGap = i + 1 < gaps.length ? next.a : next.a + Math.PI * 2;
    return { ...base, startGap: g.a, startHalf: g.h, endGap, endHalf: next.h, full: false };
  });
}

/** Angle along a wall piece at radius r for parameter t ∈ [0,1]. */
export function pieceAngle(p: WallPiece, r: number, t: number): number {
  if (p.full) return t * Math.PI * 2;
  const a0 = p.startGap + Math.asin(Math.min(0.999, p.startHalf / r));
  const a1 = p.endGap - Math.asin(Math.min(0.999, p.endHalf / r));
  return a0 + (a1 - a0) * t;
}

/** Board-space point for polar coordinates (see the convention in config.ts). */
export const polar = (r: number, a: number, y = 0) => new THREE.Vector3(r * Math.cos(a), y, -r * Math.sin(a));

/** Curved wall piece: extruded annular sector with softly bevelled top edges. */
export function wallPieceGeometry(p: WallPiece, height: number, bevel: number): THREE.BufferGeometry {
  const sink = 0.1; // bottom of the extrusion is buried in the floor so the lower bevel never shows
  const spanDeg = p.full ? 360 : (pieceAngle(p, p.outerRadius, 1) - pieceAngle(p, p.outerRadius, 0)) / DEG;
  const n = Math.max(8, Math.ceil(spanDeg / 1.5));
  const shape = new THREE.Shape();
  if (p.full) {
    shape.absarc(0, 0, p.outerRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, p.innerRadius, 0, Math.PI * 2, true); shape.holes.push(hole);
  } else {
    for (let i = 0; i <= n; i++) { const a = pieceAngle(p, p.outerRadius, i / n), x = p.outerRadius * Math.cos(a), y = p.outerRadius * Math.sin(a); i ? shape.lineTo(x, y) : shape.moveTo(x, y); }
    for (let i = n; i >= 0; i--) { const a = pieceAngle(p, p.innerRadius, i / n); shape.lineTo(p.innerRadius * Math.cos(a), p.innerRadius * Math.sin(a)); }
    shape.closePath();
  }
  const total = height + sink;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: total - 2 * bevel, steps: 1, curveSegments: 96,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 4
  });
  // Shape XY -> board XZ (shape y maps to -z), extrusion depth -> +Y
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -sink + bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Quarter-circle helper for lathe profiles. */
function arc(pts: THREE.Vector2[], cx: number, cy: number, r: number, a0: number, a1: number, n = 6) {
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
}

/** Turned base: solid disc, rounded outer edge, raised outer rim and the carved channel floor. */
export function baseGeometry(m: MazeConfig): THREE.BufferGeometry {
  const R = m.outerRadius, T = m.baseThickness, H = m.wallHeight, ri = m.rimInnerRadius, b = m.outerBevel, e = m.edgeBevel, f = 0.04;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, -T)];
  arc(pts, R - b, -T + b, b, -Math.PI / 2, 0);                 // bottom outer edge
  arc(pts, R - b * 1.4, H - b * 1.4, b * 1.4, 0, Math.PI / 2, 8); // top outer edge (worn, rounder)
  arc(pts, ri + e, H - e, e, Math.PI / 2, Math.PI);            // rim inner top edge
  arc(pts, ri - f, f, f, 0, -Math.PI / 2);                      // small fillet where the rim meets the floor
  pts.push(new THREE.Vector2(ri - 0.3, 0), new THREE.Vector2(0.0001, 0));
  const geo = new THREE.LatheGeometry(pts, 256);
  return geo;
}

/** Raised central knob with a rounded top edge and a very slight dome. */
export function knobGeometry(m: MazeConfig): THREE.BufferGeometry {
  const { radius: r, height: h, bevel: b } = m.knob;
  const pts: THREE.Vector2[] = [new THREE.Vector2(r, -0.05), new THREE.Vector2(r, h - b)];
  arc(pts, r - b, h - b, b, 0, Math.PI / 2, 10);
  pts.push(new THREE.Vector2(r * 0.5, h + 0.006), new THREE.Vector2(0.0001, h + 0.008));
  return new THREE.LatheGeometry(pts, 128);
}
