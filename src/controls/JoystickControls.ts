import { CONTROLS } from '../config';
import { clampToDisc, type ControlMode, type TiltInput, type TiltSource } from './types';

/**
 * Virtual joystick built on Pointer Events, used both as the optional desktop mouse control and as
 * the touch fallback on phones. Displacement from the pad centre requests tilt; it never moves the
 * balls directly. Pointer capture keeps it tracking when the pointer leaves the pad.
 */
export class JoystickControls implements TiltSource {
  mode: ControlMode = 'touch';
  private pointerId: number | null = null;
  private value = { x: 0, z: 0 };

  constructor(private pad: HTMLElement, private knob: HTMLElement) {
    pad.addEventListener('pointerdown', this.onDown);
    pad.addEventListener('pointermove', this.onMove);
    pad.addEventListener('pointerup', this.onUp);
    pad.addEventListener('pointercancel', this.onUp);
    pad.addEventListener('lostpointercapture', this.onUp);
  }

  setMode(mode: 'mouse' | 'touch'): void { this.mode = mode; }
  setVisible(v: boolean): void { this.pad.hidden = !v; if (!v) this.reset(); }
  get visible(): boolean { return !this.pad.hidden; }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId; this.pad.setPointerCapture(e.pointerId);
    this.pad.classList.add('engaged'); this.update(e); e.preventDefault();
  };
  private onMove = (e: PointerEvent) => { if (e.pointerId === this.pointerId) this.update(e); };
  private onUp = (e: PointerEvent) => { if (e.pointerId === this.pointerId) this.reset(); };

  private update(e: PointerEvent) {
    const r = this.pad.getBoundingClientRect(), radius = r.width / 2 * 0.72;
    const dx = (e.clientX - (r.left + r.width / 2)) / radius, dy = (e.clientY - (r.top + r.height / 2)) / radius;
    const v = clampToDisc({ x: dx, z: -dy }), dz = CONTROLS.joystickDeadZone, l = Math.hypot(v.x, v.z);
    const k = l < dz ? 0 : (l - dz) / (1 - dz) / (l || 1);
    this.value.x = v.x * k; this.value.z = v.z * k;
    this.knob.style.transform = `translate(${v.x * radius}px, ${-v.z * radius}px)`;
  }

  active(): boolean { return this.pointerId !== null; }
  read(out: TiltInput): TiltInput { out.x = this.value.x; out.z = this.value.z; return out; }

  reset(): void {
    if (this.pointerId !== null && this.pad.hasPointerCapture(this.pointerId)) this.pad.releasePointerCapture(this.pointerId);
    this.pointerId = null; this.value.x = 0; this.value.z = 0;
    this.pad.classList.remove('engaged'); this.knob.style.transform = '';
  }
}
