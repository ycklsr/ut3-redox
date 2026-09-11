/* Le vérificateur d'équilibrage.
   Les équations de référence ci-dessous sont celles du cours et des quatre
   annales, plus des variantes fautives construites à la main. Le moteur ne
   devine rien : il compte les atomes, somme les charges, compare.        */
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

/* équation, verdict attendu : true équilibrée, false déséquilibrée, 'err' illisible */
const CAS = [
  ['MnO4- + 8H+ + 5e- = Mn2+ + 4H2O', true],
  ['MnO₄⁻ + 8 H⁺ + 5 e⁻ → Mn²⁺ + 4 H₂O', true],
  ['Cr2O72- + 14H+ + 6e- = 2Cr3+ + 7H2O', true],
  ['Cr2O7 2- + 14H+ + 6e- = 2Cr3+ + 7H2O', true],
  ['O2 + 4H+ + 4e- = 2H2O', true],
  ['2H+ + 2e- = H2', true],
  ['HSO4- + 3H+ + 2e- = SO2 + 2H2O', true],
  ['SO42- + 4H+ + 2e- = SO2 + 2H2O', true],
  ['FeO42- + 8H+ + 3e- = Fe3+ + 4H2O', true],
  ['BrO3- + 5H+ + 4e- = HBrO + 2H2O', true],
  ['Fe(OH)3 + 3H+ + e- = Fe2+ + 3H2O', true],
  ['2 Cu2+ + H2O + 2e- = Cu2O(s) + 2H+', true],
  ['IO3- + 5H+ + 4Ag(s) = HIO + 2H2O + 4Ag+', true],
  ['3H3PO4 + 2P(s) + 3H2O = 5H3PO3', true],
  ['ClO- + AsO2- + 2OH- = Cl- + AsO43- + H2O', true],
  ['Hg2+ + 2e- = Hg', true],
  ['Sn4+ + 2e- = Sn2+', true],
  ['Cu2+ + Zn = Cu + Zn2+', true],
  ['MnO4- + 8H+ + 5e- = Mn2+ + 3H2O', false],
  ['MnO4- + 8H+ = Mn2+ + 4H2O', false],
  ['MnO4- + 5e- = Mn2+ + 4H2O', false],
  ['Cr2O72- + 14H+ + 6e- = Cr3+ + 7H2O', false],
  ['Fe2+ + Hg2+ = Fe3+ + Hg', false],
  ['Mno4- + 8H+ + 5e- = Mn2+ + 4H2O', 'err'],
  ['MnO4- + 8H+ + 5e-', 'err'],
  ['MnO4- = Mn2+ = X', 'err'],
  ['Fe(OH3 + 3H+ = Fe2+', 'err'],
  ['MnQ4- + 8H+ = Mn2+', 'err']
];

test('le moteur tranche juste sur les vingt-huit cas de référence', async () => {
  const { ctx, page, errors } = await open();
  const lus = await page.evaluate(cas => cas.map(([eq]) => {
    const r = window.__redox.verifieEquation(eq);
    return r.err ? 'err' : r.ok;
  }), CAS);
  const fautes = [];
  CAS.forEach(([eq, att], i) => { if (lus[i] !== att) fautes.push(`${eq} → ${lus[i]} au lieu de ${att}`); });
  assert.deepEqual(fautes, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('la charge finale se lit comme un chimiste l\'écrit', async () => {
  const { ctx, page } = await open();
  /* « MnO4- » : le 4 est un indice · « Fe3+ » : le 3 est une charge */
  const lus = await page.evaluate(() => ['MnO4-', 'Fe3+', 'Cr2O72-', 'SO42-', 'H+', 'OH-', 'Sn4+', 'PtCl62-']
    .map(f => { const sp = window.__redox.parseEspece(window.__redox.eqNorm(f));
      return sp.err ? 'err' : JSON.stringify(sp.atoms) + '|' + sp.charge; }));
  assert.deepEqual(lus, [
    '{"Mn":1,"O":4}|-1', '{"Fe":1}|3', '{"Cr":2,"O":7}|-2', '{"S":1,"O":4}|-2',
    '{"H":1}|1', '{"O":1,"H":1}|-1', '{"Sn":1}|4', '{"Pt":1,"Cl":6}|-2'
  ]);
  await ctx.close();
});

test('les pistes se déduisent de l\'écart, elles ne s\'inventent pas', async () => {
  const { ctx, page } = await open();
  const p = await page.evaluate(() => ({
    eau: window.__redox.verifieEquation('MnO4- + 8H+ + 5e- = Mn2+ + 3H2O').pistes.join(' '),
    prot: window.__redox.verifieEquation('MnO4- + 5e- = Mn2+ + 4H2O').pistes.join(' '),
    autre: window.__redox.verifieEquation('Cr2O72- + 14H+ + 6e- = Cr3+ + 7H2O').pistes.join(' ')
  }));
  assert.match(p.eau, /1 H<sub>2<\/sub>O<\/b> à droite/);
  assert.match(p.prot, /8 H<sup>\+<\/sup><\/b> à gauche/);
  assert.match(p.autre, /autres que H et O/);
  await ctx.close();
});

/* Le côté des électrons ne se lit pas dans la sortie du code : il se
   déduit de la chimie. L'électron porte une charge négative, il va donc
   du côté trop POSITIF — l'inverse d'un atome manquant. Le premier test
   écrit ici affirmait « 5 e⁻ à droite » pour le permanganate : il avait
   été recopié sur le bug au lieu d'être pensé.                          */
const ELEC = [
  ['Fe3+ = Fe2+',                'gauche', 1, 'une réduction : Fe³⁺ capte l\'électron'],
  ['MnO4- + 8H+ = Mn2+ + 4H2O',  'gauche', 5, 'une réduction : Mn passe de +VII à +II'],
  ['Cu2+ = Cu',                  'gauche', 2, 'une réduction : le cuivre se dépose'],
  ['Zn = Zn2+',                  'droite', 2, 'une oxydation : le zinc cède'],
  ['2Cl- = Cl2',                 'droite', 2, 'une oxydation : les chlorures cèdent'],
  ['H2 = 2H+',                   'droite', 2, 'une oxydation : le dihydrogène cède']
];
test('les électrons vont du côté trop positif, jamais l\'inverse', async () => {
  const { ctx, page } = await open();
  const fautes = await page.evaluate(cas => cas.map(([eq, cote, n, pourquoi]) => {
    const v = window.__redox.verifieEquation(eq);
    const p = (v.pistes || []).join(' ');
    const attendu = new RegExp(n + ' e<sup>−</sup></b> à ' + cote);
    /* contrôle indépendant : le membre de gauche doit être le plus positif
       quand les électrons y vont, et l'inverse sinon                      */
    const sensAttendu = v.qG > v.qD ? 'gauche' : 'droite';
    if (sensAttendu !== cote) return eq + ' : le cas de référence est mal posé';
    return attendu.test(p) ? null : eq + ' (' + pourquoi + ') : attendu « ' + n + ' e⁻ à ' + cote + ' », obtenu « ' + p.replace(/<[^>]+>/g, '') + ' »';
  }).filter(Boolean), ELEC);
  assert.deepEqual(fautes, []);
  await ctx.close();
});

test('une minuscule fautive est nommée comme telle', async () => {
  const { ctx, page } = await open();
  const e = await page.evaluate(() => window.__redox.verifieEquation('Mno4- + 8H+ = Mn2+').err);
  assert.match(e, /casse porte du sens/);
  assert.match(e, /« O »/);
  await ctx.close();
});

/* ── l'outil de la paillasse ──────────────────────────────────────── */
test('l\'outil rend son verdict à mesure qu\'on écrit', async () => {
  const { ctx, page } = await open('eqb');
  assert.match(await page.textContent('#eq-out'), /Écris une équation/);
  await page.fill('#eq-in', 'MnO4- + 8H+ + 5e- = Mn2+ + 4H2O');
  await page.dispatchEvent('#eq-in', 'input');
  const bon = await page.textContent('#eq-out');
  assert.match(bon, /Équilibrée/);
  assert.match(bon, /échange .*5 électrons/s);
  await page.fill('#eq-in', 'MnO4- + 8H+ + 5e- = Mn2+ + 3H2O');
  await page.dispatchEvent('#eq-in', 'input');
  const mauvais = await page.textContent('#eq-out');
  assert.match(mauvais, /Pas encore/);
  assert.match(mauvais, /1 H2O à droite/);
  assert.equal(await page.locator('#eq-out tr.faux').count(), 2, 'les deux lignes fautives sont marquées');
  await ctx.close();
});

test('les exemples de l\'outil remplissent le champ', async () => {
  const { ctx, page } = await open('eqb');
  const n = await page.locator('#eq-ex button').count();
  assert.ok(n >= 4, `${n} exemples`);
  await page.locator('#eq-ex button').last().click();
  assert.match(await page.textContent('#eq-out'), /casse porte du sens/);
  await ctx.close();
});

test('le réglage de l\'outil survit au rechargement', async () => {
  const { ctx, page } = await open('eqb');
  await page.fill('#eq-in', 'O2 + 4H+ + 4e- = 2H2O');
  await page.dispatchEvent('#eq-in', 'input');
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  assert.equal(await page.inputValue('#eq-in'), 'O2 + 4H+ + 4e- = 2H2O');
  await ctx.close();
});

/* ── le geste 2b, mode « équation entière » ───────────────────────── */
test('le geste 2b propose d\'écrire l\'équation entière, et la corrige', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e4'; });
  await page.waitForFunction(() => !document.getElementById('e4').hidden);
  await page.click('.go[data-entr="2b"]');
  await page.waitForSelector('.entr[data-entr-for="2b"] .ent-fields');
  assert.equal(await page.locator('.entr[data-entr-for="2b"] .ent-mode').count(), 2, 'deux modes');
  await page.click('.entr[data-entr-for="2b"] .ent-mode[data-mode="eq"]');
  await page.waitForSelector('.entr[data-entr-for="2b"] input.eqin');
  /* on attend que l'énoncé lui-même soit celui du mode équation */
  await page.waitForFunction(() =>
    /en entier/.test(document.querySelector('.entr[data-entr-for="2b"] .q3').textContent));

  /* Les douze demi-équations du banc, une par une : on force le tirage en
     remplaçant Math.random, on écrit l'équation telle que le site la rend, et
     le correcteur doit dire « Juste » à chaque fois. Un échantillon au hasard
     ne prouvait rien et vacillait sous charge ; douze cas forcés prouvent le
     banc entier.                                                            */
  const n = await page.evaluate(() => window.__redox.EQUIL.length);
  const fautes = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate(i => { Math.random = () => (i + 0.5) / window.__redox.EQUIL.length; }, i);
    await page.click('.entr[data-entr-for="2b"] .ent-new');
    await page.waitForFunction(() => { const b = document.querySelector('.entr[data-entr-for="2b"]'); return !!(b.__Q && b.__Q.sol && b.__Q.sol.eq && b.querySelector('input.eqin')); });
    const r = await page.evaluate(i => {
      const R = window.__redox, box = document.querySelector('.entr[data-entr-for="2b"]'), q = R.EQUIL[i];
      const t = R.demiEq(q).replace(/<[^>]+>/g, '');
      const inp = box.querySelector('input.eqin'); inp.value = t; inp.dispatchEvent(new Event('input', { bubbles: true }));
      return { t, enonce: box.querySelector('.q3').textContent.replace(/\s+/g, ' ') };
    }, i);
    await page.click('.entr[data-entr-for="2b"] .ent-ok');
    const corr = await page.textContent('.entr[data-entr-for="2b"] .corr');
    if (!/Juste/.test(corr)) fautes.push(`n° ${i} · saisi « ${r.t} » · énoncé « ${r.enonce.slice(0, 90)} » · verdict « ${corr.replace(/\s+/g, ' ').slice(0, 160)} »`);
  }
  assert.deepEqual(fautes, []);
  await ctx.close();
});

test('le geste 2b refuse une équation équilibrée mais hors sujet', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e4'; });
  await page.waitForFunction(() => !document.getElementById('e4').hidden);
  await page.click('.go[data-entr="2b"]');
  await page.click('.entr[data-entr-for="2b"] .ent-mode[data-mode="eq"]');
  await page.waitForSelector('.entr[data-entr-for="2b"] input.eqin');
  await page.fill('.entr[data-entr-for="2b"] input.eqin', 'Cu2+ + Zn = Cu + Zn2+');
  await page.click('.entr[data-entr-for="2b"] .ent-ok');
  const c = await page.textContent('.entr[data-entr-for="2b"] .corr');
  assert.match(c, /Équilibrée/, "l'équation saisie est bien équilibrée en elle-même");
  assert.match(c, /pas celle du couple demandé/, 'mais elle ne répond pas à la question');
  assert.equal(await page.locator('.entr[data-entr-for="2b"] .corr.mauvais').count(), 1);
  await ctx.close();
});

test('le mode choisi pour un geste survit au rechargement', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e4'; });
  await page.waitForFunction(() => !document.getElementById('e4').hidden);
  await page.click('.go[data-entr="2b"]');
  await page.click('.entr[data-entr-for="2b"] .ent-mode[data-mode="eq"]');
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  await page.evaluate(() => { location.hash = 'e4'; });
  await page.waitForFunction(() => !document.getElementById('e4').hidden);
  await page.click('.go[data-entr="2b"]');
  await page.waitForSelector('.entr[data-entr-for="2b"] .ent-fields');
  assert.equal(await page.locator('.entr[data-entr-for="2b"] input.eqin').count(), 1, 'le mode équation est retenu');
  await ctx.close();
});

/* ═══════════════════════════════════════════════════════════════════
   Conserver les atomes et les charges ne suffit pas : il faut transformer.
   Le critère exigeait l'oxydant à gauche, le réducteur à droite et n
   électrons à gauche. L'identité « MnO4- + Mn2+ + 5e- = MnO4- + Mn2+ +
   5e- » remplit les trois et vaut 0 = 0 : elle était déclarée juste.
   ═══════════════════════════════════════════════════════════════════ */
test('une équation qui ne transforme rien est refusée', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e4'; });
  await page.waitForFunction(() => !document.getElementById('e4').hidden);
  await page.click('.go[data-entr="2b"]');
  await page.waitForSelector('.entr[data-entr-for="2b"] .ent-fields');
  await page.click('.entr[data-entr-for="2b"] .ent-mode[data-mode="eq"]');
  await page.waitForSelector('.entr[data-entr-for="2b"] input.eqin');
  const box = '.entr[data-entr-for="2b"]';
  /* MnO4−/Mn2+ : premier du banc, cinq électrons */
  const cas = [
    ['MnO4- + 8H+ + 5e- = Mn2+ + 4H2O', true, 'la demi-équation attendue'],
    ['MnO4- + Mn2+ + 5e- = MnO4- + Mn2+ + 5e-', false, 'l\'identité : équilibrée, mais 0 = 0'],
    ['MnO4- + 8H+ + 5e- + MnO4- = Mn2+ + 4H2O + MnO4-', true, 'un spectateur en trop ne change pas le bilan net'],
    ['MnO4- + 8H+ + 5e- = Mn2+ + 4H2O + 5e- + 5e-', false, 'des électrons rendus à droite'],
    ['5e- = 5e-', false, 'ni oxydant ni réducteur']
  ];
  const fautes = [];
  for (const [saisie, attendu, quoi] of cas) {
    await page.evaluate(() => { Math.random = () => 0.5 / window.__redox.EQUIL.length; });
    await page.click(box + ' .ent-new');
    await page.waitForFunction(() => {
      const b = document.querySelector('.entr[data-entr-for="2b"]');
      return !!(b.__Q && b.__Q.sol && b.__Q.sol.eq && b.querySelector('input.eqin'));
    });
    await page.evaluate(([s, v]) => {
      const i = document.querySelector(s); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true }));
    }, [box + ' input.eqin', saisie]);
    await page.click(box + ' .ent-ok');
    const juste = (await page.getAttribute(box + ' .corr', 'class')).indexOf('bon') >= 0;
    if (juste !== attendu) fautes.push(quoi + ' · « ' + saisie + ' » · ' + (juste ? 'acceptée' : 'refusée'));
  }
  assert.deepEqual(fautes, []);
  await ctx.close();
});

test('l\'identité reçoit un diagnostic qui dit ce qui manque', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e4'; });
  await page.waitForFunction(() => !document.getElementById('e4').hidden);
  await page.click('.go[data-entr="2b"]');
  await page.click('.entr[data-entr-for="2b"] .ent-mode[data-mode="eq"]');
  await page.waitForSelector('.entr[data-entr-for="2b"] input.eqin');
  const box = '.entr[data-entr-for="2b"]';
  await page.evaluate(() => { Math.random = () => 0.5 / window.__redox.EQUIL.length; });
  await page.click(box + ' .ent-new');
  await page.waitForSelector(box + ' input.eqin');
  await page.fill(box + ' input.eqin', 'MnO4- + Mn2+ + 5e- = MnO4- + Mn2+ + 5e-');
  await page.click(box + ' .ent-ok');
  const c = await page.textContent(box + ' .corr');
  assert.match(c, /Équilibrée/, 'le bilan reste juste, et le dire est honnête');
  assert.match(c, /ne transforme rien/, 'mais l\'équation ne transforme rien');
  /* et le message « hors sujet » reste réservé aux équations qui, elles,
     transforment quelque chose */
  await page.fill(box + ' input.eqin', 'Cu2+ + Zn = Cu + Zn2+');
  await page.click(box + ' .ent-ok');
  const c2 = await page.textContent(box + ' .corr');
  assert.match(c2, /pas celle du couple demandé/);
  assert.doesNotMatch(c2, /ne transforme rien/);
  await ctx.close();
});
