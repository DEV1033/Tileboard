// Dev helper: launch the installed Chrome/Edge headless and connect puppeteer over a debugging port.
// (Recent Edge builds don't report their DevTools endpoint the way puppeteer.launch expects.)
import puppeteer from 'puppeteer-core'; import fs from 'fs'; import os from 'os'; import path from 'path'; import { spawn } from 'child_process';

const EXE = [process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));

export async function openBrowser(extraArgs = []) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-browser-'));
  const proc = spawn(EXE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...extraArgs, 'about:blank'], { stdio: 'ignore' });
  let browser;
  for (let i = 0; i < 100 && !browser; i++) {
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, protocolTimeout: 600000 }); }
    catch { await new Promise(r => setTimeout(r, 150)); }
  }
  if (!browser) { proc.kill(); throw new Error('Could not connect to ' + EXE); }
  const close = async () => {
    try { await browser.close(); } catch { /* already gone */ }
    proc.kill();
    // Edge holds the profile for a moment after exit; retry so no profile is left in %TEMP%
    for (let i = 0; i < 20; i++) { try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  };
  return { browser, close };
}
