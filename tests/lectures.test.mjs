/* Les lectures guidées — une figure, une chaîne de questions, un registre.
   Ces tests gardent trois choses : la forme de chaque lecture, le
   fonctionnement du moteur, et surtout la chaîne du raisonnement — tout
   fait sur lequel une question s'appuie doit avoir été établi plus tôt
   dans le fil. C'est la garde contre les sauts pédagogiques.          */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const FILE = new URL('../redox.html', import.meta.url);
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });
async function open(width = 1280, theme = 'light') {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(FILE.href);
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  return { ctx, page, errors };
}
/* la liste des lectures dans l'ordre du fil, avec leur étape et leurs beats */
async function inventaire(page) {
  return page.evaluate(() => {
    const R = window.__redox;
    return [...document.querySelectorAll('.lecture[data-lecture]')].map(sec => {
      const id = sec.dataset.lecture, L = R.LECTURES[id];
      return { id, etape: R.lgEtape(id), titre: L.titre,
        beats: L.beats.map(b => ({ t: b.t, q: b.q, note: b.note, uses: b.uses || [],
          setup: (b.setup || '').replace(/<[^>]+>/g, ' '),
          opts: b.opts.map(o => ({ ok: !!o.ok, why: o.why || '', t: o.t.replace(/<[^>]+>/g, ' ') })) })) };
    });
  });
}
async function goStep(page, n) {
  await page.evaluate(n => { location.hash = 'e' + n; }, n);
  await page.waitForFunction(n => !document.getElementById('e' + n).hidden, n);
}

/* ── 1 · la chaîne : aucun fait n'est utilisé avant d'être établi ── */
test('aucune question ne s\'appuie sur un fait établi plus tard dans le fil', async () => {
  const { ctx, page } = await open();
  const inv = await inventaire(page);
  assert.ok(inv.length >= 1, 'au moins une lecture');
  const pos = new Map();   // « lecture:n » → rang absolu dans le fil
  let rang = 0;
  for (const L of inv) for (let k = 0; k < L.beats.length; k++) pos.set(L.id + ':' + (k + 1), rang++);
  const fautes = [];
  for (const L of inv) for (let k = 0; k < L.beats.length; k++) {
    const moi = pos.get(L.id + ':' + (k + 1));
    for (const u of L.beats[k].uses) {
      if (!pos.has(u)) fautes.push(`${L.id}:${k + 1} s'appuie sur ${u}, qui n'existe pas`);
      else if (pos.get(u) >= moi) fautes.push(`${L.id}:${k + 1} s'appuie sur ${u}, établi plus tard`);
    }
  }
  assert.deepEqual(fautes, []);
  /* et les lectures sont bien rangées dans l'ordre des étapes */
  for (let i = 1; i < inv.length; i++) assert.ok(inv[i].etape >= inv[i - 1].etape, inv[i].id + ' est avant ' + inv[i - 1].id);
  await ctx.close();
});

/* ── 2 · la forme de chaque lecture ─────────────────────────────── */
test('chaque question a une seule bonne réponse, un diagnostic par mauvaise, et un fait à établir', async () => {
  const { ctx, page } = await open();
  const inv = await inventaire(page);
  const fautes = [];
  for (const L of inv) L.beats.forEach((b, k) => {
    const id = L.id + ':' + (k + 1);
    if (!b.t || !b.q || !b.note) fautes.push(id + ' : titre, question ou fait manquant');
    if (b.opts.length < 3) fautes.push(id + ' : moins de trois options');
    if (b.opts.filter(o => o.ok).length !== 1) fautes.push(id + ' : il faut exactement une bonne réponse');
    for (const o of b.opts) if (!o.ok && !o.why.trim()) fautes.push(id + ' : une mauvaise réponse sans diagnostic — « ' + o.t.trim().slice(0, 40) + ' »');
    if (b.note.length > 160) fautes.push(id + ' : fait trop long pour le registre (' + b.note.length + ' signes)');
  });
  assert.deepEqual(fautes, []);
  await ctx.close();
});

/* ── 3 · compréhension, pas lecture — la convention 6 vaut ici aussi ─ */
test('la bonne réponse d\'une lecture ne se recopie pas dans son énoncé', async () => {
  const { ctx, page } = await open();
  const inv = await inventaire(page);
  const VIDES = new Set(('le la les un une des du de au aux et ou est sont ete a ont dans pour par sur avec sans ' +
    'que qui quoi dont ne pas plus moins ce cette ces cet il elle on nous vous ils elles se sa son ses leur leurs ' +
    'en comme mais donc car si tout tous toute toutes meme aussi bien tres etre avoir fait faire cela ceci celui ' +
    'celle ceux vaut valent donne donnent alors deja encore jamais toujours peut peuvent doit doivent quand ' +
    'lorsque parce puisque ainsi entre vers chaque autre autres seul seule seulement').split(' '));
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9,+\-−·]/g, ' ').replace(/\s+/g, ' ').trim();
  const mots = t => norm(t).split(' ').filter(w => w.length >= 3 && !VIDES.has(w));
  const fautes = [];
  for (const L of inv) L.beats.forEach((b, k) => {
    const ctx = ' ' + norm(b.setup + ' ' + b.q) + ' ';
    const score = t => { const m = mots(t); return m.length ? m.filter(w => ctx.indexOf(' ' + w + ' ') >= 0).length / m.length : 0; };
    const sb = score(b.opts.find(o => o.ok).t), sm = Math.max(0, ...b.opts.filter(o => !o.ok).map(o => score(o.t)));
    if (sb >= 0.6 && sm <= 0.3) fautes.push(`${L.id}:${k + 1} : bonne réponse présente à ${Math.round(sb * 100)} % dans l'énoncé, mauvaises à ${Math.round(sm * 100)} % au plus`);
  });
  assert.deepEqual(fautes, []);
  await ctx.close();
});

/* ── 4 · le moteur : mauvaise réponse, diagnostic, abandon, bonne réponse, registre ── */
test('une lecture avance, diagnostique, abandonne au troisième essai et remplit son registre', async () => {
  const { ctx, page, errors } = await open();
  const inv = await inventaire(page);
  const L = inv[0];
  await goStep(page, L.etape);
  const sec = page.locator(`.lecture[data-lecture="${L.id}"]`);
  /* point de départ : pas de question, un bouton pour commencer */
  assert.equal(await sec.locator('.lg-opt').count(), 0);
  await sec.locator('[data-lg-go="1"]').first().click();
  assert.equal(await sec.locator('.lg-opt').count(), L.beats[0].opts.length);
  /* une mauvaise réponse : diagnostic, la suivante reste fermée */
  const mauvais = L.beats[0].opts.findIndex(o => !o.ok), bon = L.beats[0].opts.findIndex(o => o.ok);
  await sec.locator(`[data-lg-opt="${mauvais}"]`).click();
  assert.match(await sec.locator('.lg-fb').textContent(), /Pas celle-là/);
  assert.equal(await sec.locator(`[data-lg-opt="${mauvais}"]`).getAttribute('data-state'), 'bad');
  assert.equal(await sec.locator('.lg-nav [data-lg-go="2"]').isDisabled(), true);
  assert.equal(await sec.locator('.lg-book li:not(.vide)').count(), 0);
  /* la bonne : le fait entre au registre, la suivante s'ouvre */
  await sec.locator(`[data-lg-opt="${bon}"]`).click();
  assert.match(await sec.locator('.lg-fb').textContent(), /^Oui\./);
  assert.equal(await sec.locator('.lg-book li:not(.vide)').count(), 1);
  assert.equal((await sec.locator('.lg-book li').first().textContent()).trim(), L.beats[0].note);
  assert.equal(await sec.locator('.lg-nav [data-lg-go="2"]').isDisabled(), false);
  /* question 2 : trois erreurs, on arrête les frais — établi quand même, mais marqué */
  await sec.locator('.lg-nav [data-lg-go="2"]').click();
  const faux = L.beats[1].opts.map((o, i) => o.ok ? -1 : i).filter(i => i >= 0);
  assert.ok(faux.length >= 3, 'il faut trois mauvaises réponses pour ce test');
  for (const i of faux.slice(0, 3)) await sec.locator(`[data-lg-opt="${i}"]`).click();
  assert.match(await sec.locator('.lg-fb').textContent(), /La réponse/);
  assert.equal(await sec.locator('.lg-book li:not(.vide)').count(), 2);
  /* le registre global de la paillasse suit */
  await page.click('.dock .tab[data-tool="etabli"]');
  const reg = await page.textContent('#etabli');
  assert.match(reg, /2 faits établis/);
  assert.ok(reg.includes(L.beats[0].note) && reg.includes(L.beats[1].note));
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ── 5 · la progression survit au rechargement, et se remet à zéro ── */
test('la progression d\'une lecture persiste, puis « tout recommencer » l\'efface', async () => {
  const { ctx, page } = await open();
  const inv = await inventaire(page);
  const L = inv[0];
  await goStep(page, L.etape);
  const sec = page.locator(`.lecture[data-lecture="${L.id}"]`);
  await sec.locator('[data-lg-go="1"]').first().click();
  await sec.locator(`[data-lg-opt="${L.beats[0].opts.findIndex(o => o.ok)}"]`).click();
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  await goStep(page, L.etape);
  assert.equal(await sec.locator('.lg-book li:not(.vide)').count(), 1, 'le fait établi a survécu');
  assert.equal(await sec.locator('.lg-fb').textContent().then(t => /Oui\./.test(t)), true, 'la question reste répondue');
  /* jusqu'au bilan, puis remise à zéro */
  for (let k = 1; k < L.beats.length; k++) {
    await sec.locator(`.lg-nav [data-lg-go="${k + 1}"]`).click();
    await sec.locator(`[data-lg-opt="${L.beats[k].opts.findIndex(o => o.ok)}"]`).click();
  }
  await sec.locator(`.lg-nav [data-lg-go="${L.beats.length + 1}"]`).click();
  assert.equal(await sec.locator('.lg-final').count(), 1, 'le bilan s\'affiche');
  assert.equal(await sec.locator('.lg-book li:not(.vide)').count(), L.beats.length);
  await sec.locator('[data-lg-reset]').click();
  assert.equal(await sec.locator('.lg-book li:not(.vide)').count(), 0);
  assert.equal(await sec.locator('.lg-opt').count(), 0, 'retour au point de départ');
  await ctx.close();
});

/* ── 6 · aucun débordement, sur chaque question, aux trois largeurs ── */
for (const width of [320, 375, 1280]) for (const theme of ['light', 'dark']) {
  test(`lectures guidées : largeur ${width}, thème ${theme}, sans débordement horizontal`, async () => {
    const { ctx, page, errors } = await open(width, theme);
    const inv = await inventaire(page);
    const fautes = [];
    for (const L of inv) {
      await goStep(page, L.etape);
      for (let i = 0; i <= L.beats.length + 1; i++) {
        await page.evaluate(([id, i]) => document.querySelector(`.lecture[data-lecture="${id}"] [data-lg-go="${i}"]`).click(), [L.id, i]);
        const d = await page.evaluate(id => {
          const r = document.getElementById('read'), sec = document.querySelector(`.lecture[data-lecture="${id}"]`);
          const lim = r.getBoundingClientRect().right + 1;
          const out = [...sec.querySelectorAll('*')].filter(el => el.getClientRects().length && el.getBoundingClientRect().right > lim && !el.closest('.lg-eq'))
            .map(el => el.tagName + '.' + (el.className.baseVal ?? el.className)).slice(0, 3);
          return { read: r.scrollWidth - r.clientWidth, out };
        }, L.id);
        if (d.read > 1) fautes.push(`${L.id} question ${i} : colonne +${d.read} px ${d.out.join(' ')}`);
      }
    }
    assert.deepEqual(fautes, []);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

/* ── 7 · chaque question s'accompagne d'une figure, et l'onglet du registre existe ── */
test('chaque question porte une figure, et le registre de la paillasse liste chaque lecture', async () => {
  const { ctx, page } = await open();
  const inv = await inventaire(page);
  for (const L of inv) {
    await goStep(page, L.etape);
    for (let i = 0; i <= L.beats.length + 1; i++) {
      await page.evaluate(([id, i]) => document.querySelector(`.lecture[data-lecture="${id}"] [data-lg-go="${i}"]`).click(), [L.id, i]);
      const fig = await page.evaluate(id => {
        const f = document.querySelector(`.lecture[data-lecture="${id}"] .lg-fig`);
        return { svg: !!f.querySelector('svg'), eq: !!f.querySelector('.lg-eq'), h: f.getBoundingClientRect().height, cap: (f.querySelector('.lg-cap') || {}).textContent || '' };
      }, L.id);
      assert.ok(fig.svg || fig.eq, `${L.id} question ${i} : figure vide`);
      assert.ok(fig.h > 60, `${L.id} question ${i} : figure écrasée`);
    }
  }
  await page.click('.dock .tab[data-tool="etabli"]');
  const reg = await page.textContent('#etabli');
  for (const L of inv) assert.ok(reg.includes(L.titre), 'le registre nomme ' + L.titre);
  assert.match(reg, new RegExp('sur ' + inv.reduce((n, L) => n + L.beats.length, 0)));
  await ctx.close();
});
