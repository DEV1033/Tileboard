import * as THREE from 'three';
import { VIEW } from '../config';
import { CameraController, type Frame } from './CameraController';
import { setupLighting } from './Lighting';
import { themeBackground } from '../ui/theme';

/** Where the board is framed: during play, and on the landing hero (null when the hero has no visual column). */
export interface Frames { game(w: number, h: number): Frame; hero(): Frame | null }

const ease = (t: number) => t * t * (3 - 2 * t);

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly cameraCtl = new CameraController();
  private disposeLighting: () => void;
  /** 1 = framed in the hero's visual column, 0 = framed for play; animates between the two. */
  private heroBlend = 1;
  private heroTarget = 1;
  private size = { w: 1, h: 1 };
  private gameFrame: Frame | null = null;
  private heroFrame: Frame | null = null;
  private ratioCap = Infinity;
  private avgDt = 1 / 60;
  private adaptFrames = 0;

  constructor(private container: HTMLElement, private mobile: boolean, private frames: Frames) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.disposeLighting = setupLighting(this.scene, this.renderer, mobile);
    this.applyTheme();
    this.resize();
    window.addEventListener('themechange', this.applyTheme);
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
  }

  get camera(): THREE.PerspectiveCamera { return this.cameraCtl.camera; }

  /** Backdrop and fog follow the page's --bg token, so the board sits on the same colour as the UI in either theme. */
  private applyTheme = () => {
    const bg = new THREE.Color(themeBackground());
    this.scene.background = bg;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(bg);
  };

  /** Glide the board from the hero column to the play position (or back). */
  setHero(on: boolean, instant = false): void {
    this.heroTarget = on ? 1 : 0;
    // measure once at the start of the glide (the joystick may just have appeared), not on every frame of it
    this.gameFrame = this.frames.game(this.size.w, this.size.h); this.heroFrame = this.frames.hero();
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) { this.heroBlend = this.heroTarget; this.resize(); }
  }

  /** Full resize: canvas buffers, pixel ratio and both frames (DOM reads). Only on real size changes. */
  resize = () => {
    this.size.w = this.container.clientWidth || window.innerWidth; this.size.h = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(this.size.w, this.size.h, false);
    this.gameFrame = this.frames.game(this.size.w, this.size.h);
    this.heroFrame = this.frames.hero();
    this.updateCamera();
  };

  /** Cheap per-frame camera update from the cached frames (no buffer reallocation, no layout reads). */
  private updateCamera(): void {
    const { w, h } = this.size, game = this.gameFrame!, hero = this.heroBlend > 0 ? this.heroFrame : null;
    const t = hero ? ease(this.heroBlend) : 0, mix = (a: number, b: number) => a + (b - a) * t;
    this.cameraCtl.resize(w, h, hero ? { x: mix(game.x, hero.x), y: mix(game.y, hero.y), w: mix(game.w, hero.w), h: mix(game.h, hero.h) } : game);
    // keep the fog behind the board however far back the camera sits (a small frame pulls it far away)
    if (this.scene.fog instanceof THREE.Fog) {
      const d = this.camera.position.length();
      this.scene.fog.near = d + 12; this.scene.fog.far = d + 44;
    }
  }

  private pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.mobile ? VIEW.maxPixelRatioMobile : VIEW.maxPixelRatio, this.ratioCap);
  }

  /**
   * Adaptive resolution: if frames average slower than ~50 fps for about a second, render at a lower
   * pixel ratio (down to 1) so motion stays fluid. It only steps down, never back up, so it can't oscillate.
   */
  private adapt(dt: number): void {
    if (dt <= 0 || dt >= 0.1) return; // skip stalls (tab switch, first frame)
    this.avgDt += (dt - this.avgDt) * 0.05;
    if (++this.adaptFrames < 60) return;
    if (this.avgDt > 1 / 50 && this.pixelRatio() > 1) {
      this.ratioCap = Math.max(1, this.pixelRatio() - 0.25);
      this.resize();
    }
    this.adaptFrames = 0;
  }

  render(dt: number): void {
    if (this.heroBlend !== this.heroTarget) {
      const step = dt / 0.7; // seconds for the glide
      this.heroBlend = this.heroTarget > this.heroBlend ? Math.min(1, this.heroBlend + step) : Math.max(0, this.heroBlend - step);
      this.updateCamera();
    }
    this.adapt(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('themechange', this.applyTheme);
    this.disposeLighting(); this.renderer.dispose();
  }
}
