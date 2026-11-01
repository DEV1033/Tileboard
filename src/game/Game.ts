import * as THREE from 'three';
import { BALLS, CONTROLS, MAZE, PHYSICS } from '../config';
import { DeviceTiltControls } from '../controls/DeviceTiltControls';
import { InputManager } from '../controls/InputManager';
import { JoystickControls } from '../controls/JoystickControls';
import { KeyboardControls } from '../controls/KeyboardControls';
import { TiltController } from '../controls/TiltController';
import type { TiltInput } from '../controls/types';
import { createSteelMaterial } from '../materials/MetalMaterial';
import { buildMaze } from '../maze/MazeBuilder';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../scene/SceneManager';
import { GameUI } from '../ui/GameUI';
import { GameState } from './GameState';

const ZERO: TiltInput = { x: 0, z: 0 };

export class Game {
  readonly state = new GameState();
  readonly tilt = new TiltController();
  sceneMgr!: SceneManager;
  physics!: PhysicsWorld;
  input!: InputManager;
  ui!: GameUI;
  readonly board = new THREE.Group();
  private ballMeshes: THREE.Mesh[] = [];
  private ballGeo!: THREE.SphereGeometry;
  private steel = createSteelMaterial();
  private keyboard!: KeyboardControls;
  private joystick!: JoystickControls;
  private device = new DeviceTiltControls();
  private mobile: boolean;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private acc = 0;
  private last = 0;
  private raf = 0;

  constructor(private stage: HTMLElement) {
    this.mobile = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
  }

  async init(): Promise<void> {
    await PhysicsWorld.init();
    this.ui = new GameUI({
      start: () => this.mobile ? (DeviceTiltControls.supported() ? this.startMotion() : (this.useTouch(), this.start())) : this.start(),
      reset: () => this.restart(),
      togglePause: () => this.togglePause(),
      calibrate: () => { this.device.calibrate(); this.ui.toast('Calibrated'); },
      restart: () => this.restart()
    });
    this.sceneMgr = new SceneManager(this.stage, this.mobile, { game: (w, h) => this.ui.gameFrame(w, h), hero: () => this.ui.heroFrame() });
    this.sceneMgr.scene.add(this.board);
    document.fonts?.ready.then(() => this.sceneMgr.resize()); // the hero column moves once the web fonts swap in

    const maze = buildMaze(MAZE);
    this.board.add(maze.group);

    this.tilt.sensitivity = CONTROLS.sensitivity;

    this.physics = new PhysicsWorld(this.state.starts());
    this.ballGeo = new THREE.SphereGeometry(BALLS.radius, BALLS.widthSegments, BALLS.heightSegments);
    this.syncBallMeshes();

    this.keyboard = new KeyboardControls({ reset: () => this.restart(), restart: () => this.restart(), togglePause: () => this.togglePause() });
    this.joystick = new JoystickControls(document.getElementById('joystick')!, document.getElementById('joy-knob')!);
    this.input = new InputManager(this.keyboard, this.joystick, this.device, this.mobile ? 'touch' : 'keyboard');

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state.started && !this.state.paused) this.togglePause(); }
      else { this.last = performance.now(); this.acc = 0; }
    });

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------- control modes ----------
  private async startMotion(): Promise<void> {
    const perm = await DeviceTiltControls.requestPermission(); // inside the tap gesture
    if (perm === 'granted' && await this.device.enable()) {
      this.device.calibrate();
      this.joystick.setVisible(false); this.ui.showCalibrate(true);
      this.input.activeMode = 'motion';
      this.start();
      return;
    }
    this.device.disable();
    this.useTouch(); this.start();
    this.ui.toast(perm === 'denied' ? 'Motion access denied: using the joystick' : 'No motion sensor: using the joystick', 3000);
  }

  private useTouch(): void {
    this.joystick.setMode('touch'); this.joystick.setVisible(true); this.ui.showCalibrate(false);
    this.input.activeMode = 'touch';
  }

  /** Play now: the board glides from the hero to the play position and the clock starts from zero. */
  private start(): void {
    this.ui.hideStart(); this.state.started = true;
    this.reset();
    this.last = performance.now();
    this.sceneMgr.setHero(false);
  }

  // ---------- actions ----------
  /** Balls back to their start, velocities cleared, board level, clock back to zero. */
  reset(): void {
    this.physics.reset(this.state.starts());
    this.tilt.reset(); this.input.resetAll(); this.acc = 0;
    this.state.restart(); this.ui.hideResult();
  }

  /** Space / R / Restart button: full restart (also resumes). Ignored before Start. */
  restart(): void {
    if (!this.state.started) return;
    if (this.state.paused) this.togglePause();
    this.reset();
  }

  togglePause(): void {
    if (!this.state.started) return;
    this.state.paused = !this.state.paused;
    this.input.resetAll(); this.acc = 0; this.last = performance.now();
    this.ui.setPaused(this.state.paused);
  }

  private syncBallMeshes(): void {
    while (this.ballMeshes.length > this.physics.balls.length) this.board.remove(this.ballMeshes.pop()!);
    while (this.ballMeshes.length < this.physics.balls.length) {
      const m = new THREE.Mesh(this.ballGeo, this.steel); m.castShadow = true; m.receiveShadow = true; m.name = 'ball';
      this.board.add(m); this.ballMeshes.push(m);
    }
  }

  // ---------- loop ----------
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000)); this.last = now;
    const s = this.state, running = s.started && !s.paused;
    // On the landing hero the board sways gently by itself so the balls roll (still, if reduced motion is on)
    const idle = !s.started && !this.reducedMotion;

    if (running || idle) {
      const t = now / 1000;
      const want = running ? this.input.read() : { x: Math.sin(t * 0.55) * 0.3, z: Math.sin(t * 0.37 + 1.3) * 0.3 };
      const q = this.tilt.update(want, dt);
      this.board.quaternion.copy(q);
      this.physics.setBoardRotation(q);
      this.acc += dt;
      const step = PHYSICS.timestep; let n = 0;
      while (this.acc >= step && n < PHYSICS.maxSubSteps) { this.physics.step(); this.acc -= step; n++; }
      if (n === PHYSICS.maxSubSteps) this.acc = 0; // never spiral after a stall
    } else if (!s.started) {
      this.tilt.update(ZERO, dt); this.board.quaternion.copy(this.tilt.quaternion);
    }

    const alpha = running || idle ? this.acc / PHYSICS.timestep : 1;
    const radii: number[] = [];
    this.physics.balls.forEach((b, i) => {
      if (this.physics.escaped(b)) this.physics.placeBall(b, this.state.starts()[i]);
      const m = this.ballMeshes[i];
      m.position.lerpVectors(b.prevPos, b.currPos, alpha);
      m.quaternion.slerpQuaternions(b.prevRot, b.currRot, alpha);
      radii.push(Math.hypot(b.currPos.x, b.currPos.z));
    });

    if (s.update(running ? dt : 0, radii) === 'won') this.ui.showResult(s.elapsed);
    this.ui.setTime(s.elapsed);

    this.sceneMgr.render(dt);
  };

  dispose(): void { cancelAnimationFrame(this.raf); this.physics.dispose(); this.sceneMgr.dispose(); }
}
