import './styles/main.css';
import { Game } from './game/Game';
import { GameUI } from './ui/GameUI';
import { initTheme } from './ui/theme';

initTheme();

function webglAvailable(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function boot() {
  if (!webglAvailable()) {
    GameUI.showError('3D graphics are unavailable', 'This browser or device could not start WebGL. Try enabling hardware acceleration or another browser.');
    return;
  }
  const game = new Game(document.getElementById('stage')!);
  try {
    await game.init();
    document.body.classList.add('ready');
  } catch (err) {
    console.error(err);
    GameUI.showError('The labyrinth could not start', err instanceof Error ? err.message : String(err));
    return;
  }
  // Development/test handle (read-only use): positions, state, tilt.
  (window as unknown as { labyrinth: Game }).labyrinth = game;
}

boot();
