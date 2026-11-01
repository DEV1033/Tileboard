import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Restrained studio setup: warm key from the back-left (matches the photo, where wall shadows fall
 * towards the viewer), a cool dim fill from the front-right, soft hemisphere ambient, and a
 * room environment map so the steel balls have something real to reflect.
 */
export function setupLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer, mobile: boolean): () => void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.4;
  room.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).geometry.dispose(); } });
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xf0f2ff, 0x1a1c22, 0.4));

  const key = new THREE.DirectionalLight(0xffe0bd, 2.9);
  key.position.set(-6.5, 11, -5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = key.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 40;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xc9d6ff, 0.35);
  fill.position.set(7, 5, 8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffc89a, 0.6);
  rim.position.set(2, 3, -10);
  scene.add(rim);

  // No table or ground shadow: the board floats on the flat dark backdrop.
  // (Walls still cast shadows into the grooves, which keeps the maze readable.)
  scene.background = new THREE.Color(0x1e1e1e);
  scene.fog = new THREE.Fog(0x1e1e1e, 28, 60);

  return () => { envRT.dispose(); };
}
