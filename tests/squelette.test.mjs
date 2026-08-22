/* Tests de non-régression du squelette — point 1 de l'ordre des travaux.
   Serveur HTTP éphémère (port 0, attribué par l'OS) : jamais de port fixe,
   jamais de processus survivant à la session.                              */
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

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  return { ctx, page, errors };
}

/* ── 1 · le fil existe, une seule étape à la fois ─────────────────── */
test('17 étapes, numérotées 0 à 16, une seule visible', async () => {
  const { ctx, page, errors } = await open();
  const ids = await page.$$eval('article.step', a => a.map(x => x.id));
  assert.deepEqual(ids, Array.from({ length: 17 }, (_, i) => 'e' + i));
  assert.equal(await page.locator('article.step:not([hidden])').count(), 1);
  assert.equal(await page.locator('#segs .seg').count(), 17);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ── 2 · le plan mène à l'étape, le rail suit ─────────────────────── */
test('le plan navigue, le rail et le compteur suivent', async () => {
  const { ctx, page } = await open();
  await page.click('#navlist a[href="#e12"]');
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  assert.equal(await page.locator('article.step:not([hidden])').count(), 1);
  assert.equal(await page.locator('#segs .seg.done').count(), 12);
  assert.equal(await page.locator('#segs .seg.now').count(), 1);
  assert.match(await page.textContent('#pos'), /étape 12 \/ 16/);
  assert.equal(await page.getAttribute('#navlist a[href="#e12"]', 'aria-current'), 'step');
  await ctx.close();
});

/* ── 3 · suivant / précédent ──────────────────────────────────────── */
test('suivant et précédent parcourent le fil', async () => {
  const { ctx, page } = await open();
  await page.click('#navlist a[href="#e12"]');
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  await page.click('#e12 .nx a.rt');
  await page.waitForFunction(() => !document.getElementById('e13').hidden);
  await page.click('#e13 .nx a:not(.rt)');
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  assert.equal(await page.locator('#e0 .nx a').count(), 1, 'étape 0 : pas de précédent');
  assert.equal(await page.locator('#e16 .nx a').count(), 1, 'étape 16 : pas de suivant');
  await ctx.close();
});

/* ── 4 · la bascule des gestes pointe vers les mêmes pages ────────── */
test('la bascule des gestes reconstruit le plan depuis le fil', async () => {
  const { ctx, page } = await open();
  await page.click('#m-ges');
  const familles = await page.locator('#navlist .gt').allTextContents();
  assert.equal(familles.length, 5, 'cinq familles de gestes');
  const liens = await page.$$eval('#navlist a', a => a.map(x => x.getAttribute('href')));
  assert.ok(liens.length >= 10, 'au moins dix gestes posés dans le fil');
  for (const h of liens) {
    assert.ok(await page.locator('article.step' + h).count() === 1, `${h} pointe vers une étape réelle`);
  }
  assert.ok(liens.includes('#e12'), 'le geste 4 pointe vers la loi de Nernst');
  await page.click('#m-fil');
  assert.equal(await page.locator('#navlist a').count(), 17);
  await ctx.close();
});

/* ── 5 · rien ne bouge tant qu'on ne clique pas ───────────────────── */
test('au repos un point de contrôle ne déplace rien', async () => {
  const { ctx, page } = await open();
  await page.click('#navlist a[href="#e12"]');
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  assert.equal(await page.locator('#e12 .q:not([hidden])').count(), 0);
  const avant = await page.evaluate(() => document.getElementById('e12').getBoundingClientRect().height);
  await page.waitForTimeout(120);
  const apres = await page.evaluate(() => document.getElementById('e12').getBoundingClientRect().height);
  assert.ok(Math.abs(apres - avant) / avant < 0.03, 'moins de 3 % de variation au repos');
  await page.click('#e12 .cp[data-cp="12-1"]');
  const ouvert = await page.evaluate(() => document.getElementById('e12').getBoundingClientRect().height);
  assert.ok(ouvert > apres, 'le clic, lui, ouvre bien la question');
  await ctx.close();
});

/* ── 6 · un point de contrôle validé survit au rechargement ───────── */
test('le point de contrôle se valide, se compte et persiste', async () => {
  const { ctx, page } = await open();
  await page.click('#navlist a[href="#e12"]');
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  await page.click('#e12 .cp[data-cp="12-1"]');
  await page.click('#q12-1 .opt[data-ok="1"]');
  await page.waitForSelector('#e12 .cp[data-cp="12-1"].done');
  assert.match(await page.textContent('#pos'), /1 fait vérifié/);
  assert.match(await page.textContent('#e12 h1 .cnt'), /1 \/ 3 vérifiés/);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  await page.waitForSelector('#e12 .cp[data-cp="12-1"].done');
  assert.match(await page.textContent('#pos'), /1 fait vérifié/);
  await ctx.close();
});

/* ── 7 · thème sombre ─────────────────────────────────────────────── */
test('le thème a trois états et repeint les couleurs chimiques', async () => {
  const { ctx, page } = await open({ colorScheme: 'light' });
  const lire = () => page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      bg: getComputedStyle(document.body).backgroundColor,
      ox: cs.getPropertyValue('--ox').trim(),
      label: document.getElementById('theme').textContent
    };
  });
  const auto = await lire();
  assert.equal(auto.theme, null);
  assert.equal(auto.label, 'Auto');
  await page.click('#theme');
  assert.equal((await lire()).theme, 'light');
  await page.click('#theme');
  const sombre = await lire();
  assert.equal(sombre.theme, 'dark');
  assert.equal(sombre.label, 'Sombre');
  assert.notEqual(sombre.bg, auto.bg, 'le fond change');
  assert.notEqual(sombre.ox, auto.ox, 'la couleur des espèces oxydées change aussi');
  await page.click('#theme');
  assert.equal((await lire()).theme, null, 'retour à auto');
  await ctx.close();
});

/* ── 8 · la casse chimique n'est jamais forcée ────────────────────── */
test('aucune capitalisation forcée sur une formule ni sur « pH »', async () => {
  const { ctx, page } = await open();
  const fautes = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      if (getComputedStyle(el).textTransform !== 'uppercase') continue;
      if (el.classList.contains('f')) { out.push('.f en majuscules : ' + el.textContent.slice(0, 30)); continue; }
      const propre = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (/pH|[A-Z][a-z]?[0-9₀-₉]|MnO|H2O/.test(propre)) out.push('texte chimique en majuscules : ' + propre.slice(0, 40));
    }
    return out;
  });
  assert.deepEqual(fautes, []);
  await ctx.close();
});

/* ── 9 · pas de débordement horizontal ────────────────────────────── */
for (const w of [1280, 1000, 820, 620, 375]) {
  test(`aucun débordement horizontal à ${w} px`, async () => {
    const { ctx, page } = await open({ viewport: { width: w, height: 800 } });
    await page.evaluate(() => { location.hash = 'e12'; });
    await page.waitForFunction(() => !document.getElementById('e12').hidden);
    const deb = await page.evaluate(() => {
      const r = document.getElementById('read');
      return { read: r.scrollWidth - r.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.ok(deb.read <= 1, `colonne de lecture : ${deb.read} px de débordement`);
    assert.ok(deb.doc <= 1, `page : ${deb.doc} px de débordement`);
    await ctx.close();
  });
}

/* ── 10 · impression : la page affichée, jamais les 17 ────────────── */
test('à l\'impression, une seule étape et aucun élément d\'interface', async () => {
  const { ctx, page } = await open();
  await page.click('#navlist a[href="#e12"]');
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  await page.emulateMedia({ media: 'print' });
  const vu = await page.evaluate(() => {
    const off = s => getComputedStyle(document.querySelector(s)).display === 'none';
    return {
      rail: off('.rail'), nav: off('#nav'), dock: off('.dockwrap'), nx: off('#e12 .nx'),
      etapes: [...document.querySelectorAll('article.step')].filter(a => a.offsetParent !== null || (!a.hidden)).length
    };
  });
  assert.ok(vu.rail && vu.nav && vu.dock && vu.nx, 'rail, plan, paillasse et suivant/précédent masqués');
  assert.equal(vu.etapes, 1, 'une seule étape imprimée');
  await ctx.close();
});

/* ── 11 · intégrité statique du balisage ──────────────────────────── */
test('identifiants de points de contrôle uniques et reliés', async () => {
  const { ctx, page } = await open();
  const bilan = await page.evaluate(() => {
    const cps = [...document.querySelectorAll('.cp')];
    const ids = cps.map(b => b.dataset.cp);
    const orphelins = cps.filter(b => !document.getElementById(b.getAttribute('aria-controls'))).map(b => b.dataset.cp);
    const sansBonne = [...document.querySelectorAll('.q')].filter(q => q.querySelectorAll('.opt[data-ok="1"]').length !== 1).map(q => q.id);
    return { ids, doublons: ids.filter((v, i) => ids.indexOf(v) !== i), orphelins, sansBonne };
  });
  assert.deepEqual(bilan.doublons, [], 'aucun identifiant en double');
  assert.deepEqual(bilan.orphelins, [], 'chaque pastille pointe vers sa question');
  assert.deepEqual(bilan.sansBonne, [], 'chaque question a exactement une bonne réponse');
  await ctx.close();
});

/* ── 12 · le tiroir du plan sous 1000 px ──────────────────────────── */
test('sous 1000 px le plan devient un tiroir qui s\'ouvre et se referme', async () => {
  const { ctx, page } = await open({ viewport: { width: 620, height: 800 } });
  const visible = () => page.evaluate(() => {
    const r = document.getElementById('nav').getBoundingClientRect();
    return r.left >= 0 && r.width > 0;
  });
  assert.equal(await visible(), false, 'fermé au départ');
  await page.click('#burger');
  await page.waitForFunction(() => {
    const r = document.getElementById('nav').getBoundingClientRect();
    return r.left >= 0 && r.width > 0;
  }, null, { timeout: 3000 });
  assert.equal(await visible(), true, 'ouvert après le clic');
  await page.click('#navlist a[href="#e14"]');
  await page.waitForFunction(() => !document.getElementById('e14').hidden);
  await page.waitForFunction(() => document.getElementById('nav').getBoundingClientRect().left < 0, null, { timeout: 3000 });
  assert.equal(await visible(), false, 'refermé après la navigation');
  await ctx.close();
});

/* ── 13 · contraste du texte posé sur l'accent, dans les deux thèmes ─ */
const CONTRASTE = `(() => {
  const lum = c => {
    const [r,g,b] = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v => {
      v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const ratio = (a,b) => { const [x,y] = [lum(a), lum(b)].sort((m,n) => n-m); return (x+0.05)/(y+0.05); };
  const out = [];
  for (const sel of ['#m-fil', '#e12 .geste .go', '.skip']) {
    const el = document.querySelector(sel); if (!el) continue;
    const cs = getComputedStyle(el);
    let bg = cs.backgroundColor;
    if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor;
    out.push([sel, Math.round(ratio(cs.color, bg) * 10) / 10]);
  }
  return out;
})()`;

for (const scheme of ['light', 'dark']) {
  test(`le texte posé sur l'accent reste lisible en thème ${scheme === 'dark' ? 'sombre' : 'clair'}`, async () => {
    const { ctx, page } = await open({ colorScheme: scheme });
    await page.evaluate(() => { location.hash = 'e12'; });
    await page.waitForFunction(() => !document.getElementById('e12').hidden);
    for (const [sel, r] of await page.evaluate(CONTRASTE)) {
      assert.ok(r >= 4.5, `${sel} : contraste ${r}:1, il en faut 4,5`);
    }
    await ctx.close();
  });
}
