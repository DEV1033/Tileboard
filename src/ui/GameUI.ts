import type { Frame } from '../scene/CameraController';
import { toggleTheme } from './theme';

const $ =<T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface UIHandlers {
  start(): void;
  reset(): void;
  togglePause(): void;
  calibrate(): void;
  restart(): void;
}

/** Time as m:ss.t (tenths), e.g. 1:07.4 */
const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Thin DOM layer: all markup lives in index.html, this wires it up and updates it. */
export class GameUI {
  private toastTimer = 0;
  private shown = '';

  constructor(h: UIHandlers) {
    $('btn-hero').addEventListener('click', () => h.start());
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => toggleTheme()));
    $('btn-reset').addEventListener('click', () => h.reset());
    $('btn-pause').addEventListener('click', () => h.togglePause());
    $('btn-resume').addEventListener('click', () => h.togglePause());
    $('btn-calibrate').addEventListener('click', () => h.calibrate());
    $('btn-again').addEventListener('click', () => h.restart());
  }

  hideStart(): void { $('hero').classList.add('leaving'); document.body.classList.add('playing'); }

  setPaused(p: boolean): void {
    $('pause').hidden = !p;
    $('btn-pause').textContent = p ? 'Resume' : 'Pause';
    $('btn-pause').setAttribute('aria-pressed', String(p));
  }

  showCalibrate(show: boolean): void { $('btn-calibrate').hidden = !show; }
  setTime(s: number): void { const t = clock(s); if (t !== this.shown) { this.shown = t; $('timer').textContent = t; } }

  showResult(s: number): void { $('win-time').textContent = clock(s); $('win').hidden = false; $('btn-again').focus({ preventScroll: true }); }
  hideResult(): void { $('win').hidden = true; }

  toast(msg: string, ms = 2600): void {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
  }

  /** Play area between the HUD (top) and bottom controls, so the camera can frame the board between them. */
  gameFrame(w: number, h: number): Frame {
    const top = Math.min($('hud').getBoundingClientRect().bottom || 0, 120);
    const joy = $('joystick'), portrait = h > w;
    const bottom = !joy.hidden && portrait ? joy.getBoundingClientRect().height + 24 : 8;
    return { x: 0, y: top, w, h: Math.max(h * 0.55, h - top - bottom) };
  }

  /** The hero's empty visual column, where the board is shown on the landing page. */
  heroFrame(): Frame | null {
    const r = $('hero-visual').getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return null;
    const px = r.width * 0.06, py = r.height * 0.08; // breathing room so the board and its shadow stay inside the lines
    return { x: r.left + px, y: r.top + py, w: r.width - 2 * px, h: r.height - 2 * py };
  }

  static showError(title: string, detail: string): void {
    $('error-title').textContent = title; $('error-detail').textContent = detail; $('error').hidden = false;
    const s = document.getElementById('hero'); if (s) s.hidden = true;
  }
}
