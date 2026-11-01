import { clampToDisc, type TiltInput, type TiltSource } from './types';

export interface KeyboardActions { reset(): void; restart(): void; togglePause(): void }

const TILT_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0]
};

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement &&
  (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !(t instanceof HTMLInputElement && t.type === 'range'));

/**
 * Tracks which keys are held (no reliance on key-repeat) and is polled once per frame.
 * Arrow keys / Space are prevented from scrolling the page; form fields keep normal typing.
 */
export class KeyboardControls implements TiltSource {
  readonly mode = 'keyboard' as const;
  private held = new Set<string>();

  constructor(private actions: KeyboardActions) {
    window.addEventListener('keydown', this.onDown, { passive: false });
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', () => this.reset());
  }

  private onDown = (e: KeyboardEvent) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code in TILT_KEYS) { this.held.add(e.code); e.preventDefault(); return; }
    if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
    switch (e.code) {
      case 'Space': e.preventDefault(); this.actions.reset(); break;
      case 'KeyR': this.actions.restart(); break;
      case 'KeyP': case 'Escape': e.preventDefault(); this.actions.togglePause(); break;
    }
  };
  private onUp = (e: KeyboardEvent) => { this.held.delete(e.code); };

  active(): boolean { return this.held.size > 0; }

  read(out: TiltInput): TiltInput {
    out.x = 0; out.z = 0;
    for (const k of this.held) { const d = TILT_KEYS[k]; if (d) { out.x += d[0]; out.z += d[1]; } }
    out.x = Math.max(-1, Math.min(1, out.x)); out.z = Math.max(-1, Math.min(1, out.z));
    return clampToDisc(out);
  }

  reset(): void { this.held.clear(); }
}
