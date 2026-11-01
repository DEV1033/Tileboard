import { CONTROLS } from '../config';
import { clampToDisc, type TiltInput, type TiltSource } from './types';

type PermissionResult = 'granted' | 'denied' | 'unsupported';
type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

const wrap180 = (a: number) => ((a + 540) % 360) - 180;

/**
 * Phone-as-controller using DeviceOrientationEvent (beta = front/back, gamma = left/right).
 *
 * Coordinate conventions (W3C spec): with the phone flat and the screen up, beta = gamma = 0.
 * beta grows when the top edge rises towards the player; gamma grows when the right edge goes down.
 * These are device axes, so they are remapped to screen axes using screen.orientation.angle:
 *
 *   angle   screen-right tilt   screen-forward tilt (top edge away/down)
 *     0          +gamma                 -beta
 *    90          +beta                  +gamma
 *   180          -gamma                 +beta
 *   270          -beta                  -gamma
 *
 * Everything is measured relative to a calibrated neutral pose (captured on Start / Calibrate and
 * automatically after a screen rotation), with angle wrapping, a dead zone and low-pass smoothing.
 * Limitation: Euler angles degenerate when the phone is held near vertical (beta ≈ ±90°); the game
 * is meant to be played with the phone held roughly flat or gently reclined.
 */
export class DeviceTiltControls implements TiltSource {
  readonly mode = 'motion' as const;
  enabled = false;
  /** Set once a real sensor reading has arrived. */
  receiving = false;
  sensitivity = 1;
  private raw = { right: 0, fwd: 0 };
  private neutral: { right: number; fwd: number } | null = null;
  private wantCalibrate = true;
  private smooth = { x: 0, z: 0 };
  private lastRead = 0;

  static supported(): boolean { return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window; }

  /** Must be called from a user gesture (iOS shows its permission prompt only then). */
  static async requestPermission(): Promise<PermissionResult> {
    if (!DeviceTiltControls.supported()) return 'unsupported';
    const ctor = DeviceOrientationEvent as OrientationCtor;
    if (typeof ctor.requestPermission !== 'function') return 'granted';
    try { return (await ctor.requestPermission()) === 'granted' ? 'granted' : 'denied'; } catch { return 'denied'; }
  }

  /** Starts listening; resolves true if usable sensor data arrives within the timeout. */
  enable(timeoutMs = 1500): Promise<boolean> {
    if (!this.enabled) {
      window.addEventListener('deviceorientation', this.onOrient);
      screen.orientation?.addEventListener?.('change', this.onRotate);
      window.addEventListener('orientationchange', this.onRotate);
      this.enabled = true;
    }
    if (this.receiving) return Promise.resolve(true);
    return new Promise(res => {
      const t0 = performance.now();
      const poll = () => { if (this.receiving) res(true); else if (performance.now() - t0 > timeoutMs) res(false); else setTimeout(poll, 50); };
      poll();
    });
  }

  disable(): void {
    window.removeEventListener('deviceorientation', this.onOrient);
    screen.orientation?.removeEventListener?.('change', this.onRotate);
    window.removeEventListener('orientationchange', this.onRotate);
    this.enabled = false; this.reset();
  }

  calibrate(): void { this.wantCalibrate = true; }

  private onRotate = () => { this.calibrate(); };

  private screenAngle(): number {
    const a = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
    return ((a % 360) + 360) % 360;
  }

  private onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    this.receiving = true;
    const b = e.beta, g = e.gamma;
    switch (this.screenAngle()) {
      case 90: this.raw.right = b; this.raw.fwd = g; break;
      case 180: this.raw.right = -g; this.raw.fwd = b; break;
      case 270: this.raw.right = -b; this.raw.fwd = -g; break;
      default: this.raw.right = g; this.raw.fwd = -b;
    }
    if (this.wantCalibrate) { this.neutral = { ...this.raw }; this.wantCalibrate = false; this.smooth.x = 0; this.smooth.z = 0; }
  };

  active(): boolean { return this.enabled && this.receiving && this.neutral !== null; }

  read(out: TiltInput): TiltInput {
    const now = performance.now(), dt = this.lastRead ? Math.min(0.1, (now - this.lastRead) / 1000) : 0; this.lastRead = now;
    if (!this.neutral) { out.x = 0; out.z = 0; return out; }
    const { fullTiltDeg, deadZoneDeg, smoothing } = CONTROLS.device;
    const shape = (d: number) => { const m = Math.abs(d); return m < deadZoneDeg ? 0 : Math.sign(d) * (m - deadZoneDeg) / (fullTiltDeg - deadZoneDeg); };
    const target = clampToDisc({
      x: shape(wrap180(this.raw.right - this.neutral.right)) * this.sensitivity,
      z: shape(wrap180(this.raw.fwd - this.neutral.fwd)) * this.sensitivity
    });
    const k = 1 - Math.exp(-smoothing * dt);
    this.smooth.x += (target.x - this.smooth.x) * k; this.smooth.z += (target.z - this.smooth.z) * k;
    out.x = this.smooth.x; out.z = this.smooth.z; return out;
  }

  reset(): void { this.smooth.x = 0; this.smooth.z = 0; }
}
