/* Captures de contrôle visuel — `npm run captures`.
   Rend les vues clés en clair et en sombre dans un dossier temporaire, pour
   les relire à l'œil après une modification de mise en page. Les tests de
   `squelette.test.mjs` vérifient la mécanique ; ceci vérifie l'allure.

   Serveur éphémère sur le port 0, attribué par l'OS : jamais de port fixe,
   jamais de processus qui survit à la commande.                            */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = process.env.CAPTURES_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'redox-captures-'));

const srv = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'redox.html';
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  r.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/redox.html`;
const b = await chromium.launch();

async function shot(name, { w = 1280, h = 900, scheme = 'light', hash = 'e12', after } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 2 });
  const p = await c.newPage();
  await p.goto(base);
  await p.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  await p.evaluate(hh => { location.hash = hh; }, hash);
  await p.waitForFunction(hh => !document.getElementById(hh).hidden, hash);
  if (after) await after(p);
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, name + '.png') });
  await c.close();
}

await shot('01-nernst-clair');
await shot('02-nernst-sombre', { scheme: 'dark' });
await shot('03-chaine',        { after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 520; }) });
await shot('04-geste',         { after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 2050; }) });
await shot('05-paillasse',     { after: p => p.click('.dock .tab[data-tool="ti"]') });
await shot('06-question',      { after: async p => { await p.click('#e12 .cp[data-cp="12-1"]'); await p.click('#q12-1 .opt[data-ok="0"]'); } });
await shot('07-gestes',        { after: p => p.click('#m-ges') });
await shot('08-couple',        { hash: 'e2' });
await shot('09-no-regles',     { hash: 'e3' });
await shot('10-demi-equation', { hash: 'e4', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 700; }) });
await shot('11-basique',       { hash: 'e5', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 1500; }) });
await shot('12-pile',          { hash: 'e7', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 420; }) });
await shot('13-pile-sombre',   { hash: 'e7', scheme: 'dark', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 420; }) });
await shot('14-echelle',       { hash: 'e11', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 1150; }) });
await shot('15-gamma',         { hash: 'e13', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 260; }) });
await shot('16-eph',           { hash: 'e14', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 900; }) });
await shot('17-eph-sombre',    { hash: 'e14', scheme: 'dark', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 900; }) });
await shot('18-corrosion',     { hash: 'e15', after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 900; }) });
await shot('19-mobile-eph',    { hash: 'e14', w: 390, h: 844, after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 780; }) });
await shot('20-mobile-pile',   { hash: 'e7', w: 390, h: 844, after: p => p.evaluate(() => { document.getElementById('read').scrollTop = 400; }) });

await b.close();
srv.close();
console.log('captures dans ' + OUT);
