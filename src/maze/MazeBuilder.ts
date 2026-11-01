import * as THREE from 'three';
import type { MazeConfig } from '../config';
import { createWoodMaterial } from '../materials/WoodMaterial';
import { baseGeometry, knobGeometry, wallPieceGeometry, wallPieces } from './MazeGeometry';

/** Builds the visible board: turned base + rim, curved walls with openings, and the centre knob. */
export function buildMaze(m: MazeConfig): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group(); group.name = 'maze';
  const boardWood = createWoodMaterial({ grainAngleDeg: 32 });
  // The knob reads as a separate piece in the photo (different figure), so it gets its own grain.
  const knobWood = createWoodMaterial({ grainAngleDeg: -55, offset: new THREE.Vector3(7.3, 0, -2.1), ringScale: 2.2 });
  const geos: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string) => {
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  };
  add(baseGeometry(m), boardWood, 'base');
  m.walls.forEach(w => wallPieces(w).forEach((p, i) => add(wallPieceGeometry(p, m.wallHeight, m.edgeBevel), boardWood, `wall-${w.name}-${i}`)));
  add(knobGeometry(m), knobWood, 'knob');
  return { group, dispose: () => { geos.forEach(g => g.dispose()); boardWood.dispose(); knobWood.dispose(); } };
}
