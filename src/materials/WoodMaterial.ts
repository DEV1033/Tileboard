import * as THREE from 'three';
import { MAZE } from '../config';

/**
 * Procedural hardwood as a *solid* texture: the colour is a function of the board-space position,
 * so the grain runs continuously across the rim, walls, cut faces and channel floors exactly as it
 * does on a board carved from one block (as in the reference photo). No UVs are used.
 *
 * Model: a plain-sawn log whose axis lies in the board plane at `grainAngle`. Growth rings become
 * long streaks across the board; domain-warped noise bends them into the flame figure seen in the
 * photo. Fine fibres, growth lines and low-frequency tone patches are layered on top.
 * Carved areas (below the wall tops, inside the rim) are darkened towards the floor to read as deep,
 * shaded grooves (#291A13-ish), and get a slightly rougher finish.
 */

export interface WoodOptions {
  grainAngleDeg?: number;
  offset?: THREE.Vector3;
  ringScale?: number;
}

// sRGB palette from the brief; THREE.Color converts to linear for the shader.
const PALETTE = { main: '#754326', hi: '#95613E', dark: '#4A2B1D', groove: '#291A13', warm: '#845235' };

const NOISE = /* glsl */ `
vec4 lab_perm(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 lab_tis(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float lab_snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = lab_perm(lab_perm(lab_perm(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = lab_tis(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float lab_fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * lab_snoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
vec3 lab_perturbNormal(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir){
  vec3 vSigmaX = dFdx(surf_pos); vec3 vSigmaY = dFdy(surf_pos); vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

export function createWoodMaterial(opts: WoodOptions = {}): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, envMapIntensity: 0.4 });
  const a = (opts.grainAngleDeg ?? 32) * Math.PI / 180;
  const uniforms = {
    uGrainDir: { value: new THREE.Vector2(Math.cos(a), Math.sin(a)) },
    uOffset: { value: opts.offset ?? new THREE.Vector3() },
    uRingScale: { value: opts.ringScale ?? 1.5 },
    uWallH: { value: MAZE.wallHeight },
    uCarveR: { value: MAZE.rimInnerRadius },
    uMain: { value: new THREE.Color(PALETTE.main) },
    uHi: { value: new THREE.Color(PALETTE.hi) },
    uDark: { value: new THREE.Color(PALETTE.dark) },
    uGroove: { value: new THREE.Color(PALETTE.groove) },
    uWarm: { value: new THREE.Color(PALETTE.warm) },
    uBump: { value: 0.9 }
  };
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBoardPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBoardPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBoardPos;
uniform vec2 uGrainDir; uniform vec3 uOffset; uniform float uRingScale, uWallH, uCarveR, uBump;
uniform vec3 uMain, uHi, uDark, uGroove, uWarm;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 wp = vBoardPos + uOffset;
  // grain frame: u along the log axis, v across it, w = height
  float gu = dot(wp.xz, uGrainDir), gv = dot(wp.xz, vec2(-uGrainDir.y, uGrainDir.x)), gw = wp.y;
  // strongly anisotropic warp: the grain wanders slowly along its length (flame figure)
  float warp = lab_fbm(vec3(gu * 0.07, gv * 0.3, gw * 0.3)) * 1.1 + lab_snoise(vec3(gu * 0.25, gv * 0.9, gw)) * 0.12;
  float rings = (gv + warp + gw * 0.35) * uRingScale;
  float rr = fract(rings);
  float late = smoothstep(0.0, 0.3, rr) * (1.0 - smoothstep(0.6, 1.0, rr));
  float growth = pow(1.0 - abs(sin(rings * 3.14159)), 14.0);
  // broad dark/light streaks stretched ~12x along the grain
  float sv = gv + warp * 0.8;
  float streak = lab_fbm(vec3(gu * 0.09, sv * 1.15, gw * 0.8) + 4.0) * 0.5 + 0.5;
  float streakFine = lab_snoise(vec3(gu * 0.3, sv * 4.5, gw * 3.0)) * 0.5 + 0.5;
  float fibre = lab_snoise(vec3(gu * 0.9, sv * 30.0, gw * 30.0)) * 0.5 + 0.5;
  float fine = lab_snoise(vec3(gu * 3.0, sv * 85.0, gw * 85.0)) * 0.5 + 0.5;
  float figure = lab_fbm(vec3(gu * 0.14, sv * 0.45, gw * 0.5) + 11.0) * 0.5 + 0.5;
  vec3 wood = mix(uDark, uMain, smoothstep(0.25, 0.7, streak));
  wood = mix(wood, uHi, smoothstep(0.58, 0.85, figure) * 0.7);
  wood = mix(wood, uWarm, smoothstep(0.45, 0.8, streakFine) * 0.3);
  wood *= 0.9 + 0.12 * late;
  wood = mix(wood, uDark * 0.7, growth * 0.3 + smoothstep(0.62, 0.95, 1.0 - streakFine) * 0.25);
  wood *= 0.86 + 0.2 * fibre + 0.07 * fine;
  float figureMix = figure;
  // carved channels: darker and slightly rougher towards the floor
  float rad = length(vBoardPos.xz);
  float carved = 1.0 - smoothstep(uCarveR + 0.02, uCarveR + 0.1, rad);
  float hN = clamp(vBoardPos.y / uWallH, 0.0, 1.0);
  float cavity = mix(1.0, pow(hN, 0.8), carved);
  wood = mix(uGroove * (0.7 + 0.5 * fibre), wood, 0.08 + 0.92 * cavity);
  diffuseColor.rgb = wood;
  float woodRough = 0.62 + 0.08 * growth - 0.08 * smoothstep(0.55, 0.85, figureMix) + 0.06 * fine + 0.14 * carved * (1.0 - hN);
  float woodH = growth * 0.5 + fibre * 0.45 + fine * 0.2 - late * 0.15;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(woodRough, 0.5, 0.88);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = lab_perturbNormal(-vViewPosition, normal, vec2(dFdx(woodH), dFdy(woodH)) * uBump * 0.012, faceDirection);`);
  };
  return mat;
}
