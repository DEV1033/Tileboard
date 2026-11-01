import * as THREE from 'three';

/** Polished stainless steel: all of its look comes from the environment map and the scene lights. */
export function createSteelMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xd8d8da,
    metalness: 1,
    roughness: 0.14,
    envMapIntensity: 1.15,
    clearcoat: 0.25,
    clearcoatRoughness: 0.08
  });
}
