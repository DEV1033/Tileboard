// Dev check: node tools/check.mjs http://localhost:4173 [outDir]
// Loads the game headless, starts it, drives the keyboard, records ball positions and screenshots.
import fs from 'fs'; import { openBrowser } from './browser.mjs';
const url = process.argv[2] || 'http://localhost:4173', out = process.argv[3] || 'reference/checks';
fs.mkdirSync(out, { recursive: true });
const { browser, close } = await openBrowser();
const errors = [];
const balls = pg => pg.evaluate(() => window.labyrinth.physics.balls.map(b => { const p = b.currPos; return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +Math.hypot(p.x, p.z).toFixed(2), +(Math.atan2(-p.z, p.x) * 180 / Math.PI + 360).toFixed(0) % 360]; }));
try {
  // ---------- desktop ----------
  const pg = await browser.newPage();
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  pg.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  await pg.setViewport({ width: 1280, height: 800 });
  await pg.goto(url); await pg.waitForFunction('window.labyrinth && window.labyrinth.physics', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  await pg.screenshot({ path: `${out}/1-start.png` });
  await pg.click('#start-desktop'); await new Promise(r => setTimeout(r, 1200));
  await pg.screenshot({ path: `${out}/2-playing.png` });
  console.log('start      ', JSON.stringify(await balls(pg)));
  const hold = async (keys, ms) => { for (const k of keys) await pg.keyboard.down(k); await new Promise(r => setTimeout(r, ms)); for (const k of keys) await pg.keyboard.up(k); };
  await hold(['KeyD'], 1500); console.log('after D    ', JSON.stringify(await balls(pg)), 'tilt', JSON.stringify(await pg.evaluate(() => window.labyrinth.tilt.current)));
  await pg.screenshot({ path: `${out}/3-tilt-right.png` });
  await hold(['KeyS'], 1500); console.log('after S    ', JSON.stringify(await balls(pg)));
  await hold(['KeyW', 'KeyA'], 1800); console.log('after W+A  ', JSON.stringify(await balls(pg)));
  await new Promise(r => setTimeout(r, 2500));
  const v = await pg.evaluate(() => window.labyrinth.physics.balls.map(b => { const l = b.body.linvel(); return +Math.hypot(l.x, l.y, l.z).toFixed(3); }));
  console.log('rest speeds', JSON.stringify(v), 'tilt', JSON.stringify(await pg.evaluate(() => window.labyrinth.tilt.current)));
  await pg.keyboard.press('Space'); await new Promise(r => setTimeout(r, 300));
  console.log('after reset', JSON.stringify(await balls(pg)));
  await pg.keyboard.press('KeyP'); await new Promise(r => setTimeout(r, 300));
  console.log('paused', await pg.evaluate(() => window.labyrinth.state.paused), 'pause overlay visible', await pg.$eval('#pause', e => !e.hidden));
  await pg.keyboard.press('KeyP');
  const fps = await pg.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('fps (software GL)', fps);
  await pg.close();

  // ---------- phone (portrait, touch, no motion sensor) ----------
  const ph = await browser.newPage();
  ph.on('pageerror', e => errors.push('[phone pageerror] ' + e.message));
  await ph.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  await ph.goto(url); await ph.waitForFunction('window.labyrinth && window.labyrinth.physics', { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  await ph.screenshot({ path: `${out}/4-phone-start.png` });
  const motionBtn = await ph.$eval('#start-motion', e => !e.hidden);
  await ph.click(motionBtn ? '#start-motion' : '#start-touch'); await new Promise(r => setTimeout(r, 2500));
  console.log('phone mode', await ph.$eval('#mode-label', e => e.textContent), 'joystick visible', await ph.$eval('#joystick', e => !e.hidden));
  const box = await ph.$eval('#joystick', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const cdp = await ph.createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', box.x, box.y); for (let i = 1; i <= 10; i++) await touch('touchMove', box.x - i * 5, box.y);
  await new Promise(r => setTimeout(r, 1200));
  console.log('phone joystick left', JSON.stringify(await balls(ph)), 'tilt', JSON.stringify(await ph.evaluate(() => window.labyrinth.tilt.current)));
  await touch('touchEnd');
  await ph.screenshot({ path: `${out}/5-phone-playing.png` });
  await ph.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 800));
  await ph.screenshot({ path: `${out}/6-phone-landscape.png` });
} finally {
  console.log(errors.length ? 'CONSOLE:\n' + [...new Set(errors)].join('\n') : 'no console errors');
  await close();
}
