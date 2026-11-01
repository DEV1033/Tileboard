// Dev tool: polar-unwrap the reference photo to measure ring radii and gap angles.
// node tools/unwrap.mjs cx cy  -> reference/unwrap.png (x = angle 0..360° CCW from +x, y = radius px)
import fs from 'fs'; import { openBrowser } from './browser.mjs';
const [cx, cy, sy = 1] = process.argv.slice(2).map(Number);

const { browser: br, close } = await openBrowser();
const pg = await br.newPage();
const img = 'data:image/png;base64,' + fs.readFileSync('reference/photo.png').toString('base64');
await pg.setContent(`<img id=i src="${img}">`); await pg.waitForFunction('document.getElementById("i").complete');
const url = await pg.evaluate(({ cx, cy, sy }) => {
  const im = document.getElementById('i'), s = document.createElement('canvas'); s.width = im.naturalWidth; s.height = im.naturalHeight;
  const sx = s.getContext('2d'); sx.drawImage(im, 0, 0); const src = sx.getImageData(0, 0, s.width, s.height).data;
  const Wd = 1440, Hd = 620, c = document.createElement('canvas'); c.width = Wd; c.height = Hd; const x = c.getContext('2d'), id = x.createImageData(Wd, Hd);
  for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) {
    const a = i / Wd * Math.PI * 2, px = Math.round(cx + j * Math.cos(a)), py = Math.round(cy - j * sy * Math.sin(a)), o = (j * Wd + i) * 4;
    if (px < 0 || py < 0 || px >= s.width || py >= s.height) continue; const k = (py * s.width + px) * 4;
    id.data[o] = src[k]; id.data[o + 1] = src[k + 1]; id.data[o + 2] = src[k + 2]; id.data[o + 3] = 255;
  }
  x.putImageData(id, 0, 0); x.font = '14px sans-serif';
  for (let d = 0; d <= 360; d += 30) { x.fillStyle = 'rgba(0,255,255,0.7)'; x.fillRect(d * 4, 0, 1, Hd); x.fillText(d + '°', d * 4 + 2, 14); }
  for (let r = 0; r <= Hd; r += 50) { x.fillStyle = 'rgba(255,255,0,0.6)'; x.fillRect(0, r, Wd, 1); x.fillText(String(r), 2, r - 2); }
  return c.toDataURL();
}, { cx, cy, sy });
fs.writeFileSync('reference/unwrap.png', Buffer.from(url.split(',')[1], 'base64')); await close(); console.log('ok');
