/* Les points de contrôle — point 7 de l'ordre des travaux.
   La convention 6 du brief exige un test qui refuse toute question dont la
   bonne réponse est la seule des options à figurer dans le paragraphe qui la
   précède. C'est ce que fait le troisième test de ce fichier.            */
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
  return { ctx, page, errors };
}

const FORMES = ['transfert', 'prediction', 'discrimination', 'inversion', 'contre-exemple'];

/* ── 1 · couverture : chaque étape a ses points de contrôle ───────── */
test('les dix-sept étapes portent toutes au moins un point de contrôle', async () => {
  const { ctx, page } = await open();
  const parEtape = await page.evaluate(() => {
    const o = {};
    for (const a of document.querySelectorAll('article.step')) o[a.id] = a.querySelectorAll('.cp').length;
    return o;
  });
  const vides = Object.entries(parEtape).filter(([, n]) => n === 0).map(([id]) => id);
  assert.deepEqual(vides, [], 'étapes sans point de contrôle');
  const total = Object.values(parEtape).reduce((a, b) => a + b, 0);
  assert.ok(total >= 35, `${total} points de contrôle seulement`);
  await ctx.close();
});

/* ── 2 · forme déclarée, structure complète ──────────────────────── */
test('chaque question déclare une des cinq formes admises', async () => {
  const { ctx, page } = await open();
  const fautes = await page.evaluate(f => {
    const out = [];
    for (const q of document.querySelectorAll('.q')) {
      const forme = q.dataset.forme;
      if (!forme) { out.push(`${q.id} : aucune forme déclarée`); continue; }
      if (f.indexOf(forme) < 0) out.push(`${q.id} : forme « ${forme} » inconnue`);
      const opts = q.querySelectorAll('.opt');
      if (opts.length < 4) out.push(`${q.id} : ${opts.length} options`);
      if (q.querySelectorAll('.opt[data-ok="1"]').length !== 1) out.push(`${q.id} : bonne réponse mal déclarée`);
      for (const o of opts) if (!o.getAttribute('data-fb')) out.push(`${q.id} : une option sans explication`);
      if (!q.querySelector('.qq')) out.push(`${q.id} : pas d'énoncé`);
    }
    return out;
  }, FORMES);
  assert.deepEqual(fautes, []);
  await ctx.close();
});

/* ── 3 · la garde de la convention 6 ─────────────────────────────────
   On compare la bonne réponse et les mauvaises au texte qui précède la
   pastille. Si la bonne y est largement présente et qu'aucune mauvaise
   ne l'est, la question teste la lecture, pas la compréhension.        */
const DETECTEUR = `(() => {
  const VIDES = new Set(('le la les un une des du de au aux et ou est sont ete a ont dans pour par sur avec sans ' +
    'que qui quoi dont ne pas plus moins ce cette ces cet il elle on nous vous ils elles se sa son ses leur leurs ' +
    'en comme mais donc car si tout tous toute toutes meme aussi bien tres etre avoir fait faire cela ceci celui ' +
    'celle ceux vaut valent donne donnent alors deja encore jamais toujours peut peuvent doit doivent quand ' +
    'lorsque parce puisque ainsi entre vers chaque autre autres seul seule seulement').split(' '));
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9,+\-\u2212\u00b7]/g, ' ').replace(/\s+/g, ' ').trim();
  const mots = t => norm(t).split(' ').filter(w => w.length >= 3 && !VIDES.has(w));
  const out = [];
  for (const q of document.querySelectorAll('.q')) {
    const cp = document.querySelector('.cp[aria-controls="' + q.id + '"]');
    if (!cp) continue;
    const porteur = cp.parentElement;
    const avant = porteur.previousElementSibling;
    let ctxTxt = porteur.textContent;
    if (avant && !avant.classList.contains('q')) ctxTxt += ' ' + avant.textContent;
    const ctx = ' ' + norm(ctxTxt) + ' ';
    const score = el => {
      const m = mots(el.textContent);
      if (!m.length) return 0;
      return m.filter(w => ctx.indexOf(' ' + w + ' ') >= 0).length / m.length;
    };
    const bonne = q.querySelector('.opt[data-ok="1"]');
    const mauvaises = [...q.querySelectorAll('.opt[data-ok="0"]')];
    const sb = score(bonne), sm = Math.max(0, ...mauvaises.map(score));
    if (sb >= 0.6 && sm <= 0.3)
      out.push(q.id + ' : bonne réponse présente à ' + Math.round(sb * 100) + ' % dans le texte, ' +
               'mauvaises à ' + Math.round(sm * 100) + ' % au plus');
  }
  return out;
})()`;

test('aucune bonne réponse n\'est lisible dans le texte qui la précède', async () => {
  const { ctx, page } = await open();
  assert.deepEqual(await page.evaluate(DETECTEUR), []);
  await ctx.close();
});

test('la garde attrape bien une question de lecture qu\'on lui glisse', async () => {
  const { ctx, page } = await open();
  /* on fabrique une question dont la bonne réponse recopie le paragraphe */
  await page.evaluate(() => {
    const art = document.getElementById('e1');
    const p = document.createElement('p');
    p.textContent = 'Le pont salin assure une conduction ionique entre les deux compartiments.';
    const cp = document.createElement('button');
    cp.className = 'cp'; cp.setAttribute('aria-controls', 'q-piege');
    p.appendChild(cp);
    const q = document.createElement('div');
    q.className = 'q'; q.id = 'q-piege'; q.dataset.forme = 'transfert'; q.hidden = true;
    q.innerHTML = '<button class="opt" data-ok="1">une conduction ionique entre les deux compartiments</button>' +
                  '<button class="opt" data-ok="0">une réaction photochimique dans le fil métallique</button>' +
                  '<button class="opt" data-ok="0">un dépôt cristallin sur la paroi du bécher</button>' +
                  '<button class="opt" data-ok="0">une dilution progressive du solvant organique</button>';
    art.appendChild(p); art.appendChild(q);
  });
  const trouve = await page.evaluate(DETECTEUR);
  assert.equal(trouve.length, 1, 'la garde doit attraper exactement la question piégée');
  assert.match(trouve[0], /^q-piege/);
  await ctx.close();
});

/* ── 4 · rien ne bouge au repos, sur les dix-sept étapes ─────────── */
test('sur aucune étape un point de contrôle n\'occupe de place au repos', async () => {
  const { ctx, page } = await open();
  const fautes = [];
  for (let i = 0; i <= 16; i++) {
    await page.evaluate(n => { location.hash = 'e' + n; }, i);
    await page.waitForFunction(n => !document.getElementById('e' + n).hidden, i);
    const n = await page.locator(`#e${i} .q:not([hidden])`).count();
    if (n) fautes.push(`e${i} : ${n} question déjà ouverte`);
  }
  assert.deepEqual(fautes, []);
  await ctx.close();
});

/* ── 5 · le compteur suit l'ensemble du site ─────────────────────── */
test('le compteur de faits vérifiés couvre tous les points de contrôle', async () => {
  const { ctx, page } = await open();
  const total = await page.locator('.cp').count();
  assert.match(await page.textContent('#pos'), new RegExp('/ ' + total + '$'));
  /* on en valide un et le compteur avance */
  await page.evaluate(() => { location.hash = 'e3'; });
  await page.waitForFunction(() => !document.getElementById('e3').hidden);
  await page.click('#e3 .cp');
  await page.click('#e3 .q:not([hidden]) .opt[data-ok="1"]');
  await page.waitForSelector('#e3 .cp.done');
  assert.match(await page.textContent('#pos'), new RegExp('1 fait vérifié / ' + total));
  assert.match(await page.textContent('#e3 h1 .cnt'), /1 \/ \d+ vérifiés/);
  await ctx.close();
});

/* ── 6 · chaque question se corrige et s'explique ────────────────── */
test('toute option, juste ou fausse, produit une explication', async () => {
  const { ctx, page } = await open();
  const fautes = [];
  for (const etape of ['e0', 'e7', 'e14']) {
    await page.evaluate(id => { location.hash = id; }, etape);
    await page.waitForFunction(id => !document.getElementById(id).hidden, etape);
    const n = await page.locator(`#${etape} .cp`).count();
    for (let k = 0; k < n; k++) {
      await page.locator(`#${etape} .cp`).nth(k).click();
      const q = page.locator(`#${etape} .q:not([hidden])`).first();
      await q.locator('.opt[data-ok="0"]').first().click();
      const fb = await q.locator('.fb').textContent();
      if (!fb || fb.trim().length < 20) fautes.push(`${etape} #${k} : explication trop courte`);
      await q.locator('.opt[data-ok="1"]').click();
      const fb2 = await q.locator('.fb').textContent();
      if (!fb2 || fb2.trim().length < 20) fautes.push(`${etape} #${k} : bonne réponse sans explication`);
      await page.locator(`#${etape} .cp`).nth(k).click();
    }
  }
  assert.deepEqual(fautes, []);
  await ctx.close();
});
