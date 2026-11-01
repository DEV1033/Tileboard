/**
 * Light / dark theme. index.html sets <html data-theme> before first paint (stored choice, else the
 * system setting); this module toggles it, remembers an explicit choice, follows the system while
 * there is none, and fires a `themechange` event so the 3D scene can repaint its backdrop.
 */
export type Theme = 'light' | 'dark';

const KEY = 'lab.theme';
const root = document.documentElement;
const systemQuery = matchMedia('(prefers-color-scheme: light)');

const stored = (): Theme | null => { try { const t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };

export const currentTheme = (): Theme => (root.dataset.theme === 'light' ? 'light' : 'dark');

/** The page background colour for the current theme (the --bg token), for the WebGL clear colour. */
export const themeBackground = (): string => getComputedStyle(root).getPropertyValue('--bg').trim() || '#1e1e1e';

function apply(t: Theme): void {
  root.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeBackground());
  document.querySelectorAll('[data-theme-toggle]').forEach(b => {
    b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    b.setAttribute('aria-pressed', String(t === 'light'));
  });
  window.dispatchEvent(new Event('themechange'));
}

export function toggleTheme(): void {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, next); } catch { /* storage unavailable: still switch for this visit */ }
  apply(next);
}

export function initTheme(): void {
  apply(currentTheme());
  systemQuery.addEventListener('change', e => { if (!stored()) apply(e.matches ? 'light' : 'dark'); });
}
