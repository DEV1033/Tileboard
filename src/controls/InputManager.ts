import type { DeviceTiltControls } from './DeviceTiltControls';
import type { JoystickControls } from './JoystickControls';
import type { KeyboardControls } from './KeyboardControls';
import type { ControlMode, TiltInput } from './types';

/**
 * Chooses which adapter drives the board. Exactly one source is read per frame:
 * keyboard while a tilt key is held, otherwise the joystick while it is touched,
 * otherwise phone motion when enabled. The most recently used source is reported as the
 * active mode for the HUD. Switching never jumps the board, because the TiltController
 * smooths whatever request it receives.
 */
export class InputManager {
  activeMode: ControlMode;
  private v: TiltInput = { x: 0, z: 0 };

  constructor(public keyboard: KeyboardControls, public joystick: JoystickControls, public device: DeviceTiltControls, initial: ControlMode) {
    this.activeMode = initial;
  }

  read(): TiltInput {
    const v = this.v;
    if (this.keyboard.active()) { this.activeMode = 'keyboard'; return this.keyboard.read(v); }
    if (this.joystick.active()) { this.activeMode = this.joystick.mode; return this.joystick.read(v); }
    if (this.device.active()) { this.activeMode = 'motion'; return this.device.read(v); }
    v.x = 0; v.z = 0; return v;
  }

  resetAll(): void { this.keyboard.reset(); this.joystick.reset(); this.device.reset(); }
}
