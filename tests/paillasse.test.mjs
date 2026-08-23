/* La paillasse — point 4 de l'ordre des travaux.
   Les valeurs de contrôle viennent des exercices 12 et 13 du cours et du
   sujet 2024 ; elles sont recalculées à la main dans PLAN.md.            */
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

async function open(tool) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  if (tool) await page.click(`.dock .tab[data-tool="${tool}"]`);
  return { ctx, page, errors };
}
const set = (page, sel, v) => page.fill(sel, String(v)).then(() => page.dispatchEvent(sel, 'input'));
const pick = (page, sel, v) => page.selectOption(sel, v);

/* ── le calculateur de Nernst ─────────────────────────────────────── */
test('Nernst — exercice 13 du cours, les deux formes', async () => {
  const { ctx, page, errors } = await open('ner');
  await pick(page, '#ner-c', 'MnO4-/Mn2+');
  await set(page, '#ner-oxm', 1); await set(page, '#ner-oxe', -3);
  await set(page, '#ner-rdm', 1); await set(page, '#ner-rde', -1);
  await set(page, '#ner-phn', 2);
  const out = await page.textContent('#ner-out');
  assert.match(out, /E = 1,294 V/, 'le potentiel à pH 2');
  assert.match(out, /E = 1,486 − 0,096 · pH/, "la forme laissée en fonction du pH");
  assert.match(out, /n = 5/); assert.match(out, /H⁺ = 8/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Nernst — un couple hors table : le sujet 2024', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', '*');
  await set(page, '#ner-e0', 0.17); await set(page, '#ner-n', 2); await set(page, '#ner-h', 3);
  await set(page, '#ner-oxm', 1); await set(page, '#ner-oxe', -2);
  await set(page, '#ner-rdm', 1); await set(page, '#ner-rde', -2);
  await set(page, '#ner-phn', 3);
  const out = await page.textContent('#ner-out');
  assert.match(out, /E = −0,10 V/, 'le potentiel du couple HSO4−/SO2 à pH 3');
  await ctx.close();
});

test('Nernst — un couple sans protons masque le champ du pH', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', 'Fe2+/Fe');
  await set(page, '#ner-oxm', 1); await set(page, '#ner-oxe', -2);
  assert.equal(await page.isVisible('#ner-ph-fld'), false, 'aucun pH à saisir');
  assert.equal(await page.isVisible('#ner-rd-fld'), false, 'le fer est solide : pas de concentration');
  const out = await page.textContent('#ner-out');
  assert.match(out, /E = −0,50 V/, 'la frontière horizontale du diagramme');
  await ctx.close();
});

test('Nernst — le curseur de pH déplace E sur une droite', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', 'MnO4-/Mn2+');
  await set(page, '#ner-oxm', 1); await set(page, '#ner-oxe', -3);
  await set(page, '#ner-rdm', 1); await set(page, '#ner-rde', -1);
  const lus = [];
  for (const ph of [0, 7, 14]) {
    await set(page, '#ner-phn', ph);
    const m = (await page.textContent('#ner-out')).match(/E = (−?\d+,\d+) V/);
    lus.push(Number(m[1].replace('−', '-').replace(',', '.')));
  }
  assert.ok(Math.abs(lus[0] - 1.486) < 0.002, `à pH 0 : ${lus[0]}`);
  assert.ok(Math.abs((lus[0] - lus[1]) - (lus[1] - lus[2])) < 0.002, 'les écarts sont égaux : c\'est une droite');
  await ctx.close();
});

/* ── l'échelle des potentiels et le γ ─────────────────────────────── */
test('le γ nomme les deux espèces qui réagissent, et l\'écart', async () => {
  const { ctx, page } = await open('ech');
  await pick(page, '#ech-a', 'MnO4-/Mn2+');
  await pick(page, '#ech-b', 'Fe3+/Fe2+');
  const v = await page.textContent('#ech-verdict');
  assert.match(v, /La réaction se fait/);
  assert.match(v, /0,74 V/, "l'écart de potentiel");
  assert.match(v, /MnO4−|MnO4/, "l'oxydant du haut est nommé");
  assert.equal(await page.locator('#ech-fig svg').count(), 1);
  await ctx.close();
});

test('le γ se lit dans le bon sens quel que soit l\'ordre de saisie', async () => {
  const { ctx, page } = await open('ech');
  await pick(page, '#ech-a', 'Fe3+/Fe2+');
  await pick(page, '#ech-b', 'MnO4-/Mn2+');
  const v = await page.textContent('#ech-verdict');
  assert.match(v, /0,74 V/, 'le même écart, positif');
  await ctx.close();
});

/* ── le traceur E-pH ──────────────────────────────────────────────── */
test('le traceur lit la pente sur la demi-équation', async () => {
  const { ctx, page } = await open('eph');
  await set(page, '#eph-n', 1); await set(page, '#eph-h', 3); await set(page, '#eph-b', 1.13);
  const r = await page.textContent('#eph-read');
  assert.match(r, /E = 1,13 − 0,18 · pH/, "l'équation de la frontière 3 du fer");
  assert.match(r, /−1,39/, 'la valeur à pH 14');
  assert.equal(await page.locator('#eph-fig svg').count(), 1);
  await ctx.close();
});

test('le traceur retrouve les deux frontières obliques du fer', async () => {
  const { ctx, page } = await open('eph');
  for (const [n, h, b, attendu] of [[1, 1, 0.236, /E = 0,236 − 0,06 · pH/], [2, 2, -0.053, /E = −0,053 − 0,06 · pH/]]) {
    await set(page, '#eph-n', n); await set(page, '#eph-h', h); await set(page, '#eph-b', b);
    assert.match(await page.textContent('#eph-read'), attendu);
  }
  await ctx.close();
});

/* ── vérifier mon calcul ──────────────────────────────────────────── */
test('le vérificateur reconnaît la bonne réponse', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', 'MnO4-/Mn2+');
  await set(page, '#ner-oxm', 1); await set(page, '#ner-oxe', -3);
  await set(page, '#ner-rdm', 1); await set(page, '#ner-rde', -1);
  await set(page, '#ner-phn', 2);
  await page.click('.dock .tab[data-tool="ti"]');
  await set(page, '#ti-rep', 1.294);
  assert.match(await page.textContent('#ti-out'), /C'est juste/);
  await ctx.close();
});

test('le vérificateur nomme l\'erreur quand le nombre la trahit', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', 'MnO4-/Mn2+');
  await set(page, '#ner-oxm', 1); await set(page, '#ner-oxe', -3);
  await set(page, '#ner-rdm', 1); await set(page, '#ner-rde', -1);
  await set(page, '#ner-phn', 2);
  await page.click('.dock .tab[data-tool="ti"]');
  /* 1,51 − 0,024 = 1,486 : le terme en pH oublié */
  await set(page, '#ti-rep', 1.486);
  assert.match(await page.textContent('#ti-out'), /terme en pH oublié/);
  /* 1,486 + 0,192 = 1,678 : le signe du terme en pH inversé */
  await set(page, '#ti-rep', 1.678);
  assert.match(await page.textContent('#ti-out'), /signe du terme en pH inversé/);
  /* 1,51 + 0,06 × (−2 − 16) = 0,43 : oubli de diviser par n */
  await set(page, '#ti-rep', 0.43);
  assert.match(await page.textContent('#ti-out'), /diviser par n/);
  await ctx.close();
});

test('le vérificateur produit une séquence de touches cohérente', async () => {
  const { ctx, page } = await open('ti');
  const keys = await page.$$eval('#ti-out .key', k => k.map(x => x.textContent));
  assert.ok(keys.includes('10ˣ'), 'le logarithme décimal');
  assert.ok(keys.includes('▶'), 'la sortie d\'exposant');
  assert.ok(keys.filter(k => k === 'ctrl').length >= 2, 'ctrl pour log et pour la valeur décimale');
  assert.equal(keys[keys.length - 1], 'enter');
  assert.ok(!keys.includes('ln'), 'jamais le logarithme népérien');
  await ctx.close();
});

/* ── pré-remplissage depuis l'étape lue ───────────────────────────── */
test('la paillasse arrive pré-remplie avec le couple de l\'étape', async () => {
  const { ctx, page } = await open('ner');
  await page.evaluate(() => { location.hash = 'e14'; });
  await page.waitForFunction(() => !document.getElementById('e14').hidden);
  assert.equal(await page.inputValue('#ner-c'), 'Fe3+/Fe2+');
  await page.evaluate(() => { location.hash = 'e13'; });
  await page.waitForFunction(() => !document.getElementById('e13').hidden);
  assert.equal(await page.inputValue('#ner-c'), 'MnO4-/Mn2+');
  assert.equal(await page.inputValue('#ech-b'), 'Fe3+/Fe2+', 'le second couple du γ suit aussi');
  await ctx.close();
});

test('les réglages des outils survivent au rechargement', async () => {
  const { ctx, page } = await open('eph');
  await set(page, '#eph-b', 0.42);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  assert.equal(await page.inputValue('#eph-b'), '0.42');
  await ctx.close();
});

/* ── une garde : SVG ne connaît ni <sub> ni <sup> ─────────────────────
   Ces balises font « sortir » l'analyseur du mode SVG : tout ce qui suit
   dans la chaîne devient du HTML, le dessin est tronqué et le texte
   s'échappe sous la figure. Le symptôme visible est un conteneur de
   figure qui contient autre chose que son svg.                        */
test('rien ne s\'échappe d\'une figure : le mode SVG n\'est jamais rompu', async () => {
  const { ctx, page } = await open();
  const fautes = await page.evaluate(async () => {
    const out = [];
    for (const t of document.querySelectorAll('.dock .tab')) t.click();
    for (const a of document.querySelectorAll('article.step')) a.hidden = false;
    for (const box of document.querySelectorAll('.toolfig, .fig')) {
      for (const nd of box.childNodes) {
        if (nd.nodeType === 3 && nd.textContent.trim())
          out.push(box.id || box.className + ' : texte échappé « ' + nd.textContent.trim().slice(0, 24) + ' »');
        else if (nd.nodeType === 1 && !/^(svg|p)$/i.test(nd.tagName))
          out.push(box.id || box.className + ' : élément inattendu <' + nd.tagName.toLowerCase() + '>');
      }
    }
    return out;
  });
  assert.deepEqual(fautes, []);
  await ctx.close();
});

test('le γ dessine bien son trajet, avec sa pointe de flèche', async () => {
  const { ctx, page } = await open('ech');
  await pick(page, '#ech-a', 'MnO4-/Mn2+');
  await pick(page, '#ech-b', 'Zn2+/Zn');
  assert.equal(await page.locator('#ech-fig svg path[marker-end]').count(), 1, 'le trajet du γ');
  const t = await page.$$eval('#ech-fig svg text', e => e.map(x => x.textContent));
  assert.ok(t.some(x => x.indexOf('MnO₄⁻') === 0), 'les indices sont en Unicode : ' + t.join(' | '));
  assert.ok(t.some(x => x === 'γ'), 'la lettre γ est dans la figure');
  await ctx.close();
});

/* ── la paillasse tient dans un écran étroit ──────────────────────── */
for (const w of [1280, 900, 430]) {
  test(`aucun outil ne déborde à ${w} px`, async () => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
    const fautes = [];
    for (const t of ['ech', 'ner', 'eph', 'ti']) {
      await page.click(`.dock .tab[data-tool="${t}"]`);
      await page.waitForTimeout(60);
      const d = await page.evaluate(() => {
        const p = document.getElementById('panel');
        return { pan: p.scrollWidth - p.clientWidth,
                 doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      if (d.pan > 1 || d.doc > 1) fautes.push(`${t} : panneau ${d.pan} px, page ${d.doc} px`);
      await page.click(`.dock .tab[data-tool="${t}"]`);
    }
    assert.deepEqual(fautes, []);
    await ctx.close();
  });
}
