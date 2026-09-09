/* Les annales — point 6 de l'ordre des travaux.
   Les valeurs de contrôle viennent des quatre corrigés officiels, relus
   page par page : ce sont les réponses attendues sur une copie.        */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'redox.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/redox.html`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  await page.evaluate(() => { location.hash = 'e16'; });
  await page.waitForFunction(() => !document.getElementById('e16').hidden);
  return { ctx, page, errors };
}

/* ── les quatre annales sont là, avec leurs corrections ───────────── */
test('quatre annales, chacune avec ses exercices et ses corrections', async () => {
  const { ctx, page, errors } = await open();
  const bilan = await page.evaluate(() => [...document.querySelectorAll('.ann')].map(a => ({
    an: a.dataset.ann,
    exos: a.querySelectorAll('.exo').length,
    corr: a.querySelectorAll('.corr-box').length,
    btns: a.querySelectorAll('.corr-btn').length
  })));
  assert.deepEqual(bilan.map(b => b.an), ['2025', '2024', '2023', '2022']);
  for (const b of bilan) {
    assert.ok(b.exos >= 5, `${b.an} : ${b.exos} blocs seulement`);
    assert.ok(b.corr >= 4, `${b.an} : ${b.corr} corrections`);
    assert.equal(b.corr, b.btns, `${b.an} : un bouton par correction`);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('chaque bouton ouvre bien sa propre correction', async () => {
  const { ctx, page } = await open();
  const orphelins = await page.evaluate(() => [...document.querySelectorAll('.corr-btn')]
    .filter(b => !document.getElementById(b.getAttribute('aria-controls')))
    .map(b => b.getAttribute('aria-controls')));
  assert.deepEqual(orphelins, []);
  await ctx.close();
});

/* ── les corrections sont repliées au repos ───────────────────────── */
test('aucune correction n\'est visible avant qu\'on la demande', async () => {
  const { ctx, page } = await open();
  assert.equal(await page.locator('#e16 .corr-box:not([hidden])').count(), 0);
  const avant = await page.evaluate(() => document.getElementById('e16').getBoundingClientRect().height);
  await page.click('.ann[data-ann="2025"] .corr-btn');
  const apres = await page.evaluate(() => document.getElementById('e16').getBoundingClientRect().height);
  assert.ok(apres > avant, 'le clic ouvre la correction');
  assert.match(await page.textContent('.ann[data-ann="2025"] .corr-btn'), /replier/);
  await ctx.close();
});

/* ── une seule annale à la fois ───────────────────────────────────── */
test('la bascule ne montre qu\'une annale à la fois', async () => {
  const { ctx, page } = await open();
  assert.equal(await page.locator('#e16 .ann:not([hidden])').count(), 1);
  await page.click('.ann-nav button[data-ann="2022"]');
  assert.equal(await page.locator('#e16 .ann:not([hidden])').count(), 1);
  assert.equal(await page.locator('.ann[data-ann="2022"]:not([hidden])').count(), 1);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  assert.equal(await page.locator('.ann[data-ann="2022"]:not([hidden])').count(), 1, 'le choix persiste');
  await ctx.close();
});

/* ── les réponses des corrigés officiels sont bien celles affichées ── */
const REPONSES = [
  ['2025', 'c25-3', /1,05 V/,            'fem de la pile Mn / Pb'],
  ['2025', 'c25-4', /1,52 − 0,06 × 3 = 1,34 V/, 'Nernst IO3−/I− à pH 3'],
  ['2025', 'c25-2', /6 MnO4− \+ 18 H\+ \+ 5 I− ⟶ 6 Mn2\+ \+ 9 H2O \+ 5 IO3−/, 'équilibrage en milieu acide'],
  ['2024', 'c24-3', /0,16 − 0,09 × 3 = − 0,11 V/, 'Nernst HSO4−/SO2 — le E° du sujet vaut 0,16'],
  ['2024', 'c24-5', /pH = − log \[H\+\] = 8,65/, 'la verticale du diagramme du manganèse'],
  ['2024', 'c24-5', /E° = 1,29 − 0,06 = 1,23 V/, 'le potentiel standard MnO2/Mn2+'],
  ['2023', 'c23-4', /1,90 − 0,16 × 3 = 1,90 − 0,48 = 1,42 V/, 'Nernst FeO42−/Fe3+'],
  ['2023', 'c23-3', /0,80 \+ 0,76 = 1,56 V/, 'fem de la pile zinc-argent'],
  ['2023', 'c23-5', /C \(5 ; − 0,94\)/, 'le point C du diagramme du chrome'],
  ['2022', 'c22-4', /0,95 − 0,06 × 4 × 2 \+ 0,12 = 0,59 V/, 'Nernst MnO2/Mn3+ à pH 2'],
  ['2022', 'c22-3', /0,80 − 0,34 = 0,46 V/, 'fem de la pile argent-cuivre'],
  ['2022', 'c22-5', /B \(5 ; 0,40\)/, 'le point B du diagramme du cuivre'],
  ['2022', 'c22-5', /coefficient directeur : \+ 0,06/, 'la seule pente positive des quatre annales']
];
test('les valeurs des quatre corrigés officiels sont celles du site', async () => {
  const { ctx, page } = await open();
  const manquants = [];
  for (const [an, id, motif, quoi] of REPONSES) {
    const txt = await page.evaluate(i => {
      const b = document.getElementById(i);
      return b ? b.textContent.replace(/\s+/g, ' ') : null;
    }, id);
    if (txt === null) { manquants.push(`${an} · ${id} absent`); continue; }
    if (!motif.test(txt)) manquants.push(`${an} · ${quoi}`);
  }
  assert.deepEqual(manquants, []);
  await ctx.close();
});

/* ── le E° du sujet 2024 doit être le même partout dans le site ───── */
test('E°(HSO4−/SO2) vaut 0,16 V partout, jamais 0,17', async () => {
  const { ctx, page } = await open();
  const fautes = await page.evaluate(() => {
    /* la seule mention légitime est l'avertissement « pas 0,17 » du corrigé 2024 */
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length) continue;                       /* feuilles seulement */
      if (el.closest('.scan')) continue;
      if ((el.textContent || '').indexOf('0,17') >= 0)
        out.push(el.className + ' : ' + el.textContent.slice(0, 40));
    }
    return out;
  });
  assert.deepEqual(fautes, []);
  /* et l'étape 12 conclut bien à −0,11 V */
  await page.evaluate(() => { location.hash = 'e12'; });
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  assert.match(await page.textContent('#e12 .res .v'), /−\s?0,11 V/);
  await ctx.close();
});

/* ── le chronomètre ───────────────────────────────────────────────── */
test('le chronomètre part d\'une heure, tourne, se met en pause et se remet à zéro', async () => {
  const { ctx, page } = await open();
  assert.equal(await page.textContent('#chr-t'), '60:00');
  assert.equal(await page.isVisible('#chr-rail'), false, 'rien dans la barre au repos');
  await page.click('#chr-go');
  await page.waitForFunction(() => document.getElementById('chr-t').textContent !== '60:00', null, { timeout: 3000 });
  assert.equal(await page.isVisible('#chr-rail'), true, 'le temps suit dans la barre');
  assert.match(await page.textContent('#chr-go'), /pause/);
  await page.click('#chr-go');
  const t1 = await page.textContent('#chr-t');
  await page.waitForTimeout(1200);
  assert.equal(await page.textContent('#chr-t'), t1, 'en pause, le temps ne bouge plus');
  await page.click('#chr-rz');
  assert.equal(await page.textContent('#chr-t'), '60:00');
  await ctx.close();
});

test('le chronomètre reste visible quand on change d\'étape', async () => {
  const { ctx, page } = await open();
  await page.click('#chr-go');
  await page.waitForFunction(() => document.getElementById('chr-t').textContent !== '60:00', null, { timeout: 3000 });
  await page.evaluate(() => { location.hash = 'e12'; });
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  assert.equal(await page.isVisible('#chr-rail'), true);
  assert.match(await page.textContent('#chr-rail'), /^\d\d:\d\d$/);
  await ctx.close();
});

/* ── les deux diagrammes redessinés, manganèse 2024 et chrome 2023 ────
   Chaque point lettré porte ses coordonnées ; on les recalcule ici à
   partir des seules données de l'énoncé, sans lire le dessin.            */
test('les diagrammes du manganèse et du chrome sont tracés, et leurs points se recalculent', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e16'; });
  await page.waitForFunction(() => !document.getElementById('e16').hidden);
  const pts = await page.evaluate(() => {
    const out = {};
    for (const cid of ['c24-5', 'c23-5']) {
      const fig = document.querySelector('#' + cid + ' .fig svg');
      out[cid] = fig ? Object.fromEntries([...fig.querySelectorAll('[data-pt]')].map(c => [c.dataset.pt, { ph: +c.dataset.ph, e: +c.dataset.e }])) : null;
      out[cid + '-cap'] = (document.querySelector('#' + cid + ' .fig .cap') || {}).textContent || '';
    }
    return out;
  });
  const prox = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m} : ${a} contre ${b}`);
  /* 2024 · Mn : c = 10⁻², Ks = 2·10⁻¹³ */
  const mn = pts['c24-5']; assert.ok(mn, 'le diagramme du manganèse est dessiné');
  assert.deepEqual(Object.keys(mn).sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const pHB = 14 + 0.5 * Math.log10(2e-13 / 1e-2);
  prox(mn.B.ph, pHB, 0.005, 'B : verticale de précipitation'); prox(mn.B.ph, 8.65, 0.01, 'B : la valeur du corrigé');
  prox(mn.E.ph, pHB, 0.005, 'E : même verticale'); prox(mn.E.e, 1.29 - 0.12 * pHB, 0.002, 'E : sur D → E');
  prox(mn.A.e, -1.24, 1e-9, 'A donné'); prox(mn.D.e, 1.29, 1e-9, 'D donné'); prox(mn.G.e, 1.65, 1e-9, 'G donné');
  prox((mn.C.e - mn.B.e) / (mn.C.ph - mn.B.ph), -0.06, 1e-3, 'B → C : 2 H⁺ pour 2 e⁻');
  prox((mn.F.e - mn.E.e) / (mn.F.ph - mn.E.ph), -0.06, 1e-3, 'E → F : 2 H⁺ pour 2 e⁻');
  prox((mn.H.e - mn.G.e) / (mn.H.ph - mn.G.ph), -0.08, 1e-3, 'G → H : 4 H⁺ pour 3 e⁻, le permanganate');
  assert.match(pts['c24-5-cap'], /MnO₄⁻/); assert.match(pts['c24-5-cap'], /coquille/);
  /* 2023 · Cr : c = 10⁻¹, E°(Cr²⁺/Cr) = −0,91, E°(Cr₂O₇²⁻/Cr³⁺) = 1,33, Ks = 10⁻¹⁹ et 10⁻³⁰ */
  const cr = pts['c23-5']; assert.ok(cr, 'le diagramme du chrome est dessiné');
  assert.deepEqual(Object.keys(cr).sort(), ['A', 'B', 'C']);
  prox(cr.C.ph, 14 + 0.5 * Math.log10(1e-19 / 0.1), 1e-6, 'C : abscisse'); prox(cr.C.e, -0.91 + 0.03 * Math.log10(0.1), 1e-6, 'C : ordonnée');
  prox(cr.C.ph, 5, 1e-9, 'C : la valeur du corrigé'); prox(cr.C.e, -0.94, 1e-9, 'C : la valeur du corrigé');
  const pH3 = 14 + Math.log10(1e-30 / 0.1) / 3;
  prox(cr.B.ph, pH3, 0.005, 'B : précipitation de Cr(OH)₃');
  prox((cr.B.e - cr.A.e) / (cr.B.ph - cr.A.ph), -0.14, 1e-3, 'A → B : le coefficient directeur demandé');
  prox(cr.A.e, 1.33 + 0.01 * Math.log10(0.1 / 0.01), 1e-6, 'A : Nernst à 10⁻¹');
  await ctx.close();
});
