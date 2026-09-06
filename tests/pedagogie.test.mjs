/* La réussite d'un contrôle n'établit pas, à elle seule, un apprentissage.
   Ces tests protègent l'ordre des prérequis et le fonctionnement des essais. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const FILE = new URL('../redox.html', import.meta.url);
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });
async function open(width = 1280, theme = 'light') {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await page.goto(FILE.href);
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  return { ctx, page, errors, requests };
}
async function step(page, n) {
  await page.evaluate(n => { location.hash = 'e' + n; }, n);
  await page.waitForFunction(n => !document.getElementById('e' + n).hidden, n);
}
// Oracles indépendants des attributs data-answer de la page.
const EXPECTED = {
  'puissances-essai': [0, [-2 * 3]],
  'droite-essai': [0, [0.8, -0.04]],
  'nox-essai': [3, [3 * -2, -2 - 3 * -2]],
  'electrons-essai': [4, [2, 2 * 2]],
  'multiples-essai': [5, [6, 6 / 2, 6 / 6]],
  'coefficients-essai': [5, [3 * 1, 3 * 2, 3 * 1]],
  'multiples-transfert': [5, [12, 12 / 4, 12 / 6]],
  'basique-essai': [5, [8, 8, 8 - 3]],
  'dismutation-essai': [13, [0.5 - 0.2]],
  'nernst-essai': [12, [1e-4 / 1e-2, -2, 0.06 * -2, 0.77 + 0.06 * -2]],
  'pente-essai': [14, [3 / 2, -0.06 * 3 / 2]],
};

test('les contrôles de transfert viennent après leurs exemples et essais guidés', async () => {
  const { ctx, page } = await open();
  try {
    const result = await page.evaluate(() => {
      const questions = [...document.querySelectorAll('.q[data-prerequisites]')];
      const errors = [];
      for (const q of questions) {
        const cp = document.querySelector('.cp[aria-controls="' + q.id + '"]');
        for (const id of q.dataset.prerequisites.split(' ')) {
          const prior = document.getElementById(id);
          if (!prior || !(prior.compareDocumentPosition(cp) & Node.DOCUMENT_POSITION_FOLLOWING)) errors.push(q.id + ' avant ' + id);
          if (prior?.closest('article') !== q.closest('article')) errors.push(q.id + ' hors de son étape');
        }
      }
      return { count: questions.length, errors };
    });
    assert.ok(result.count >= 9);
    assert.deepEqual(result.errors, []);
    assert.equal(await page.locator('#e2 #q2-3').count(), 0);
    assert.equal(await page.locator('#e5 #q5-3').count(), 1);
    assert.equal(await page.locator('#e13 #q13-dismutation').count(), 1);
    assert.equal(await page.locator('#e13 [data-geste="1b"]').count(), 1);
    assert.equal(await page.locator('#e6 [data-geste="1b"]').count(), 0);
  } finally { await ctx.close(); }
});

test('les onze essais ont des résultats calculés indépendamment et des libellés accessibles', async () => {
  const { ctx, page } = await open();
  try {
    assert.equal(await page.locator('form.practice').count(), Object.keys(EXPECTED).length);
    for (const [id, [n, answers]] of Object.entries(EXPECTED)) {
      const result = await page.locator('#' + id).evaluate(form => ({
        step: form.closest('article').id,
        answers: [...form.querySelectorAll('fieldset')].map(f => Number(f.dataset.answer)),
        accessible: [...form.querySelectorAll('input')].every(i => i.labels.length && i.getAttribute('aria-describedby').split(' ').every(id => document.getElementById(id))),
        live: [...form.querySelectorAll('.practice-help,.practice-feedback,.practice-finish')].every(p => p.getAttribute('aria-live') === 'polite'),
      }));
      assert.equal(result.step, 'e' + n, id);
      assert.equal(result.answers.length, answers.length, id);
      result.answers.forEach((a, i) => assert.ok(Math.abs(a - answers[i]) < 1e-12, id + ', champ ' + i));
      assert.equal(result.accessible, true, id);
      assert.equal(result.live, true, id);
    }
  } finally { await ctx.close(); }
});

test('réponse vide, invalide ou fausse : aucun déblocage ni fait validé ; les indices permettent de réessayer', async () => {
  const { ctx, page } = await open();
  try {
    await step(page, 5);
    const form = page.locator('#multiples-essai');
    const field = form.locator('fieldset').first();
    const input = field.locator('input');
    const pos = await page.textContent('#pos');
    for (const value of ['', 'abc', '6abc', 'Infinity', 'NaN', '1e999', '0', '4']) {
      await input.fill(value);
      await field.locator('[type="submit"]').click();
      assert.equal(await input.getAttribute('aria-invalid'), 'true', value);
      assert.equal(await form.locator('fieldset:not([hidden])').count(), 1);
      assert.equal(await page.textContent('#pos'), pos);
    }
    await field.locator('.practice-hint').click();
    const firstHint = await field.locator('.practice-help').textContent();
    await field.locator('.practice-hint').click();
    assert.notEqual(await field.locator('.practice-help').textContent(), firstHint);
    assert.equal(await form.locator('fieldset:not([hidden])').count(), 1);
    await input.fill('6');
    await input.press('Enter');
    assert.equal(await form.locator('fieldset:not([hidden])').count(), 2);
    assert.equal(await input.getAttribute('aria-invalid'), null);
    assert.equal(await page.textContent('#pos'), pos);
  } finally { await ctx.close(); }
});

test('un total commun non minimal reçoit une explication, pas un faux diagnostic chimique', async () => {
  const { ctx, page } = await open();
  try {
    await step(page, 5);
    const form = page.locator('#multiples-transfert');
    await form.locator('input').first().fill('24');
    await form.locator('[type="submit"]').first().click();
    assert.match(await form.locator('.practice-feedback').first().textContent(), /24 est un total commun/);
    assert.match(await form.locator('.practice-feedback').first().textContent(), /12/);
    assert.equal(await form.locator('fieldset:not([hidden])').count(), 1);
  } finally { await ctx.close(); }
});

test('les onze essais se terminent puis se réinitialisent sans modifier les faits vérifiés', async () => {
  const { ctx, page, errors, requests } = await open();
  try {
    for (const [id, [n, answers]] of Object.entries(EXPECTED)) {
      await step(page, n);
      const pos = await page.textContent('#pos');
      const form = page.locator('#' + id);
      for (let i = 0; i < answers.length; i++) {
        const field = form.locator('fieldset').nth(i);
        assert.equal(await field.isVisible(), true, id);
        // Virgule décimale et signe moins Unicode sont volontairement utilisés.
        const text = id === 'nernst-essai' && i === 0 ? '1e−2' : String(Number(answers[i].toFixed(12))).replace('.', ',').replace('-', '−');
        await field.locator('input').fill(text);
        await field.locator('[type="submit"]').click();
        assert.equal(await field.getAttribute('disabled'), '', id + ', champ ' + i);
      }
      assert.equal(await form.locator('.practice-finish').isVisible(), true, id);
      assert.equal(await page.textContent('#pos'), pos, id);
      await form.locator('.practice-reset').click();
      assert.equal(await form.locator('fieldset:not([hidden])').count(), 1, id);
      assert.equal(await form.locator('.practice-finish').isVisible(), false, id);
      assert.equal(await form.locator('input').first().inputValue(), '', id);
      assert.equal(await form.locator('fieldset').first().getAttribute('disabled'), null, id);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, [], 'le fichier reste hors ligne');
  } finally { await ctx.close(); }
});

test('le contrôle 3/2 diagnostique 9 contre 4 et accepte une nouvelle tentative', async () => {
  const { ctx, page } = await open();
  try {
    await step(page, 5);
    await page.locator('.cp[aria-controls="q5-3"]').click();
    const q = page.locator('#q5-3');
    await q.locator('.opt[data-ok="0"]').first().click();
    assert.match(await q.locator('.fb').textContent(), /9/);
    assert.match(await q.locator('.fb').textContent(), /4/);
    assert.equal(await q.locator('.opt[data-ok="1"]').isEnabled(), true);
    await q.locator('.opt[data-ok="1"]').click();
    assert.match(await page.textContent('#pos'), /1 fait vérifié/);
  } finally { await ctx.close(); }
});

test('coefficients, charges et formule de la droite sont cohérents', async () => {
  const { ctx, page } = await open();
  try {
    const result = await page.evaluate(() => {
      const check = window.__redox.verifieEquation;
      return ['Cu2+ + 2e- = Cu', '3Cu2+ + 6e- = 3Cu', 'O2 + 4H+ + 4e- = 2H2O', '2Fe3+ + 3H2 = 2Fe + 6H+'].map(e => check(e).ok);
    });
    assert.deepEqual(result, [true, true, true, true]);
    assert.match(await page.locator('#q4-compter-atomes .qq').textContent(), /deux atomes/);
    const source = readFileSync(FILE, 'utf8');
    assert.ok(source.includes('b = E<sub>1</sub> − a × pH<sub>1</sub>'));
    assert.ok(!source.includes('b = E<sub>1</sub> + a × pH<sub>1</sub>'));
    assert.equal(0.77 - (-0.18 * 2), 1.13);
  } finally { await ctx.close(); }
});

test('le tirage de couple donne sa demi-équation et celui de dismutation donne les potentiels', async () => {
  const { ctx, page } = await open();
  try {
    const samples = await page.evaluate(() => Array.from({length: 25}, () => [window.__redox.GEN['1']().q, window.__redox.GEN['1b']().q]));
    for (const [couple, dismutation] of samples) {
      assert.match(couple, /demi-équation dans le sens de la réduction/);
      assert.match(couple, /e<sup>−<\/sup>/);
      assert.match(dismutation, /conditions standard/);
      assert.match(dismutation, /E° du premier couple/);
      assert.match(dismutation, /E° du second/);
    }
  } finally { await ctx.close(); }
});

for (const width of [320, 375, 1280]) for (const theme of ['light', 'dark']) {
  test(`essais guidés : largeur ${width}, thème ${theme}, sans débordement horizontal`, async () => {
    const { ctx, page, errors } = await open(width, theme);
    try {
      for (const [id, [n]] of Object.entries(EXPECTED)) {
        await step(page, n);
        const form = page.locator('#' + id);
        await form.locator('.practice-hint').first().click();
        const issue = await form.evaluate(f => {
          const bad = [...f.querySelectorAll('input,button,p,label,legend')].filter(el => {
            if (!el.getClientRects().length) return false;
            const r = el.getBoundingClientRect(), parent = f.getBoundingClientRect();
            return r.left < parent.left - 1 || r.right > parent.right + 1;
          });
          return { overflow: f.scrollWidth > f.clientWidth + 1, bad: bad.map(x => x.tagName) };
        });
        assert.equal(issue.overflow, false, id);
        assert.deepEqual(issue.bad, [], id);
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('une ancienne validation ne valide pas automatiquement une question au sens modifié', async () => {
  const ctx = await browser.newContext();
  try {
    await ctx.addInitScript(() => localStorage.setItem('redox.v1', JSON.stringify({ cp: { '2-3': 1, '3-3': 1, '4-2': 1, '6-1': 1 } })));
    const page = await ctx.newPage();
    await page.goto(FILE.href);
    await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
    assert.equal(await page.locator('.cp.done').count(), 0);
    assert.match(await page.textContent('#pos'), /0 fait vérifié/);
    for (const id of ['2-annulation', '3-etat-oxydation', '4-compter-atomes', '5-3', '6-reconnaitre', '13-dismutation']) {
      assert.equal(await page.locator('.cp[data-cp="' + id + '"]:not(.done)').count(), 1, id);
    }
  } finally { await ctx.close(); }
});
