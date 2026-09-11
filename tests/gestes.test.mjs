/* Les entraîneurs — point 5 de l'ordre des travaux.
   Le risque d'un tirage au hasard, c'est de corriger faux. Les tables de
   référence ci-dessous sont recopiées d'une vérification à la main : bilan
   de charge, bilan d'oxygène, bilan d'hydrogène pour chaque demi-équation,
   et nombres d'oxydation calculés élément par élément.                    */
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

const IDS = ['1', '2a', '2b', '2c', '2d', '2e', '3a', '3b', '4', '5'];

/* ── 1 · les dix gestes sont armés ────────────────────────────────── */
test('les dix gestes ont leur recette, leur piège et leur entraîneur', async () => {
  const { ctx, page } = await open();
  const bilan = await page.evaluate(() => {
    const out = [];
    for (const g of document.querySelectorAll('.geste')) {
      out.push({
        id: g.dataset.geste,
        etapes: g.querySelectorAll('ol > li').length,
        piege: !!g.querySelector('.piege'),
        bouton: !!g.querySelector('.go[data-entr]'),
        boite: !!g.querySelector('.entr'),
        pending: g.classList.contains('pending')
      });
    }
    return out;
  });
  assert.equal(bilan.length, 10, 'dix blocs gestes posés dans le fil');
  for (const g of bilan) {
    assert.ok(!g.pending, `${g.id} : encore en attente`);
    assert.ok(g.etapes >= 4, `${g.id} : ${g.etapes} étapes seulement`);
    assert.ok(g.piege, `${g.id} : pas de piège`);
    assert.ok(g.bouton && g.boite, `${g.id} : entraîneur absent`);
  }
  assert.deepEqual(bilan.map(g => g.id).sort(), IDS.slice().sort());
  await ctx.close();
});

/* ── 2 · la table des demi-équations, vérifiée à la main ──────────── */
/* [ox → rd, n, protons, eau ajoutée, H(ox), O(ox), charge(ox),
    H(rd, coefficient compris), O(rd), charge(rd)]                     */
const DEMI = [
  ['MnO4-/Mn2+',   5,  8, 4, 0, 4, -1, 0, 0,  2],
  ['Cr2O7/Cr3+',   6, 14, 7, 0, 7, -2, 0, 0,  6],
  ['O2/H2O',       4,  4, 2, 0, 2,  0, 4, 2,  0],
  ['NO3-/NO',      3,  4, 2, 0, 3, -1, 0, 1,  0],
  ['H2O2/H2O',     2,  2, 2, 2, 2,  0, 4, 2,  0],
  ['O2/H2O2',      2,  2, 0, 0, 2,  0, 2, 2,  0],
  ['H+/H2',        2,  2, 0, 0, 0,  0, 2, 0,  0],
  ['HSO4-/SO2',    2,  3, 2, 1, 4, -1, 0, 2,  0],
  ['ClO-/Cl-',     2,  2, 1, 0, 1, -1, 0, 0, -1],
  ['AsO4/AsO2',    2,  4, 2, 0, 4, -3, 0, 2, -1],
  ['SO4/SO2',      2,  4, 2, 0, 4, -2, 0, 2,  0],
  ['NO3-/NO2',     1,  2, 1, 0, 3, -1, 0, 2,  0]
];

test('chaque demi-équation d\'entraînement conserve charge, oxygène et hydrogène', async () => {
  const { ctx, page } = await open();
  const eq = await page.evaluate(() => window.__redox.EQUIL.map(q => ({ n: q.n, h: q.h, w: q.w, eau: !!q.rdEau })));
  assert.equal(eq.length, DEMI.length, 'la table de la page et celle du test ont la même taille');
  for (let i = 0; i < DEMI.length; i++) {
    const [nom, n, h, w, Hox, Oox, qox, Hrd, Ord, qrd] = DEMI[i];
    assert.deepEqual({ n: eq[i].n, h: eq[i].h, w: eq[i].w }, { n, h, w }, `${nom} : coefficients`);
    /* l'eau supplémentaire ne compte que si le réducteur n'est pas l'eau lui-même */
    const wExtra = eq[i].eau ? 0 : w;
    if (nom !== 'H+/H2') {
      assert.equal(qox + h - n, qrd, `${nom} : bilan de charge`);
      assert.equal(Oox, Ord + wExtra, `${nom} : bilan de l'oxygène`);
      assert.equal(Hox + h, Hrd + 2 * wExtra, `${nom} : bilan de l'hydrogène`);
    }
  }
  /* et le rendu lui-même, tel que le site l'affiche, doit être équilibré sur
     tous les éléments — c'est le chrome du dichromate qui manquait, et que
     le bilan O/H/charge ci-dessus ne pouvait pas voir                     */
  const rendus = await page.evaluate(() => window.__redox.EQUIL.map(q => {
    const txt = window.__redox.demiEq(q).replace(/<[^>]+>/g, '');
    const r = window.__redox.verifieEquation(txt);
    return { txt, ok: !!r.ok && !r.err, err: r.err || '' };
  }));
  assert.deepEqual(rendus.filter(r => !r.ok).map(r => r.txt + (r.err ? ' — ' + r.err : '')), [], 'chaque demi-équation rendue est équilibrée');
  await ctx.close();
});

/* ── 2 bis · les corrections générées, passées au vérificateur ───────
   `demiEq` n'est pas le seul endroit qui écrit une équation : le geste 2c
   fabrique la sienne pour le milieu basique. Elle a longtemps perdu le 2
   du dichromate, que la garde ci-dessus ne pouvait pas voir puisqu'elle
   ne regardait que `demiEq`. On passe donc au vérificateur l'équation de
   chaque correction générée, sur chacun des couples tirables.          */
test('les équations des corrections générées sont toutes équilibrées', async () => {
  const { ctx, page } = await open();
  const bilan = await page.evaluate(() => {
    const R = window.__redox, out = [];
    const extrait = html => { const m = html.match(/<span class="e f">(.*?)<\/span><span class="lab">/s); return m ? m[1].replace(/<[^>]+>/g, '') : null; };
    const vrai = Math.random;
    /* 2c · milieu basique : un tirage forcé par couple éligible */
    const pool = R.EQUIL.filter(x => !x.rdEau);
    for (let i = 0; i < pool.length; i++) {
      Math.random = () => (i + 0.5) / pool.length;
      const eq = extrait(R.GEN['2c']().corr);
      const v = eq ? R.verifieEquation(eq) : { err: 'aucune équation dans la correction' };
      if (!eq || !v.ok) out.push('2c · ' + (eq || '—') + ' — ' + (v.err || ('écart de charge ' + v.dq + ', atomes ' + (v.lignes || []).filter(l => l.dif).map(l => l.el).join(' '))));
    }
    /* 2b · milieu acide, les deux modes */
    for (let i = 0; i < R.EQUIL.length; i++) {
      Math.random = () => (i + 0.5) / R.EQUIL.length;
      for (const mode of ['coef', 'eq']) {
        const eq = extrait(R.GEN['2b'](mode).corr);
        const v = eq ? R.verifieEquation(eq) : { err: 'aucune équation' };
        if (!eq || !v.ok) out.push('2b/' + mode + ' · ' + (eq || '—') + ' — ' + (v.err || ('écart de charge ' + v.dq)));
      }
    }
    Math.random = vrai;
    return out;
  });
  assert.deepEqual(bilan, []);
  await ctx.close();
});

/* ── 3 · les nombres d'oxydation, recalculés élément par élément ──── */
const NOREF = {
  'ClO4': 7, 'CO3': 4, 'TiCl4': 4, 'MnO4': 7, 'Cr2O7': 6, 'SO4': 6, 'NO3': 5,
  'H2O2': -1, 'SO2': 4, 'HSO4': 6, 'Fe2O3': 3, 'Fe(OH)3': 3, 'Fe(OH)2': 2,
  'NH4': -3, 'ClO': 1, 'AsO2': 3, 'AsO4': 5, 'PbO2': 4, 'H2SO4': 6, 'KMnO4': 7
};
test('les vingt nombres d\'oxydation sont ceux du calcul à la main', async () => {
  const { ctx, page } = await open();
  const nox = await page.evaluate(() => window.__redox.NOX.map(x => ({
    f: x.f.replace(/<sup>.*?<\/sup>/g, '').replace(/<[^>]+>/g, ''), el: x.el, no: x.no })));
  assert.equal(nox.length, 20);
  for (const x of nox) {
    const attendu = NOREF[x.f];
    assert.notEqual(attendu, undefined, `espèce inconnue du test : ${x.f}`);
    assert.equal(x.no, attendu, `${x.f} — n.o. de ${x.el}`);
  }
  await ctx.close();
});

/* ── 4 · chaque générateur produit une question bien formée ───────── */
test('les dix générateurs tirent des questions complètes et cohérentes', async () => {
  const { ctx, page, errors } = await open();
  const fautes = await page.evaluate(ids => {
    const out = [];
    for (const id of ids) {
      for (let k = 0; k < 40; k++) {
        let Q;
        try { Q = window.__redox.GEN[id](); } catch (e) { out.push(`${id} : ${e.message}`); break; }
        if (!Q || !Q.q || !Q.corr) { out.push(`${id} : énoncé ou correction vide`); break; }
        if (!Q.champs || !Q.champs.length) { out.push(`${id} : aucun champ`); break; }
        for (const c of Q.champs) {
          if (!(c.k in Q.sol)) { out.push(`${id} : le champ ${c.k} n'a pas de solution`); }
          if (c.type === 'sel') {
            if (!c.opts.some(o => String(o[0]) === String(Q.sol[c.k])))
              out.push(`${id} : la solution ${Q.sol[c.k]} de ${c.k} n'est pas dans les options`);
          } else if (!isFinite(Q.sol[c.k])) {
            out.push(`${id} : la solution de ${c.k} n'est pas un nombre`);
          }
        }
        if (/undefined|NaN|\[object/.test(Q.q + Q.corr)) out.push(`${id} : trou dans le texte`);
      }
    }
    return out;
  }, IDS);
  assert.deepEqual(fautes, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ── 5 · la loi de Nernst du geste 4, recalculée dans le test ─────── */
test('le geste 4 corrige avec la même valeur qu\'un calcul indépendant', async () => {
  const { ctx, page } = await open();
  const lots = await page.evaluate(() => {
    const out = [];
    for (let k = 0; k < 30; k++) {
      const Q = window.__redox.GEN['4']();
      const m = Q.q.match(/pH = (\d+)/);
      const c = Q.__c || null;
      out.push({ sol: Q.sol, ph: m ? +m[1] : null, q: Q.q.replace(/<[^>]+>/g, '') });
    }
    return out;
  });
  for (const l of lots) {
    assert.ok(l.ph !== null, 'le pH figure dans l\'énoncé');
    /* la pente et le potentiel doivent être liés par E = b − a·pH, b ≤ E° + 1 */
    assert.ok(Math.abs(l.sol.a) < 0.5, `pente hors norme : ${l.sol.a}`);
    assert.ok(l.sol.a <= 0, 'une pente en pH est toujours négative ou nulle');
    assert.ok(Math.abs(l.sol.E) < 3, `potentiel hors norme : ${l.sol.E}`);
  }
  await ctx.close();
});

/* ── 6 · la correction accepte la solution et refuse une erreur ───── */
test('un entraîneur valide la bonne réponse et signale la mauvaise', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e3'; });
  await page.waitForFunction(() => !document.getElementById('e3').hidden);
  await page.click('.go[data-entr="2a"]');
  await page.waitForSelector('.entr[data-entr-for="2a"] .ent-fields');

  /* on remplit avec la solution déclarée */
  await page.evaluate(() => {
    const box = document.querySelector('.entr[data-entr-for="2a"]');
    const c = box.__Q.champs[0];
    box.querySelector('[data-k="' + c.k + '"]').value = String(box.__Q.sol[c.k]);
  });
  await page.click('.entr[data-entr-for="2a"] .ent-ok');
  assert.match(await page.textContent('.entr[data-entr-for="2a"] .corr'), /Juste/);

  /* puis avec une valeur fausse */
  await page.click('.entr[data-entr-for="2a"] .ent-new');
  await page.evaluate(() => {
    const box = document.querySelector('.entr[data-entr-for="2a"]');
    const c = box.__Q.champs[0];
    box.querySelector('[data-k="' + c.k + '"]').value = String(box.__Q.sol[c.k] + 3);
  });
  await page.click('.entr[data-entr-for="2a"] .ent-ok');
  assert.match(await page.textContent('.entr[data-entr-for="2a"] .corr'), /Pas encore/);
  await page.click('.entr[data-entr-for="2a"] .ent-voir');
  assert.match(await page.textContent('.entr[data-entr-for="2a"] .corr'), /La correction/);
  await ctx.close();
});

/* ── 7 · le score se compte, s'affiche et persiste ────────────────── */
test('le score d\'un geste se compte sur le premier essai et persiste', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e3'; });
  await page.waitForFunction(() => !document.getElementById('e3').hidden);
  await page.click('.go[data-entr="2a"]');
  for (const bon of [true, true, false]) {
    await page.evaluate(b => {
      const box = document.querySelector('.entr[data-entr-for="2a"]');
      const c = box.__Q.champs[0];
      box.querySelector('[data-k="' + c.k + '"]').value = String(box.__Q.sol[c.k] + (b ? 0 : 5));
    }, bon);
    await page.click('.entr[data-entr-for="2a"] .ent-ok');
    await page.click('.entr[data-entr-for="2a"] .ent-ok');   /* un second essai ne recompte pas */
    await page.click('.entr[data-entr-for="2a"] .ent-new');
  }
  assert.match(await page.textContent('.go[data-entr="2a"]'), /2 réussis sur 3/);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#segs .seg').length === 17);
  assert.match(await page.textContent('.go[data-entr="2a"]'), /2 réussis sur 3/);
  await ctx.close();
});

/* ── 8 · rien ne bouge tant qu'on ne clique pas ───────────────────── */
test('un entraîneur reste fermé tant que le bouton n\'est pas cliqué', async () => {
  const { ctx, page } = await open();
  await page.evaluate(() => { location.hash = 'e12'; });
  await page.waitForFunction(() => !document.getElementById('e12').hidden);
  assert.equal(await page.locator('#e12 .entr:not([hidden])').count(), 0);
  const avant = await page.evaluate(() => document.getElementById('e12').getBoundingClientRect().height);
  await page.click('.go[data-entr="4"]');
  const apres = await page.evaluate(() => document.getElementById('e12').getBoundingClientRect().height);
  assert.ok(apres > avant, 'le clic ouvre bien le tirage');
  await page.click('.go[data-entr="4"]');
  assert.equal(await page.locator('#e12 .entr:not([hidden])').count(), 0, 'un second clic referme');
  await ctx.close();
});

/* ── 9 · la demi-équation rendue ne double aucun terme ────────────── */
test('chaque demi-équation rendue porte le proton une seule fois', async () => {
  const { ctx, page } = await open();
  const lignes = await page.evaluate(() =>
    window.__redox.EQUIL.map(q => ({
      h: q.h,
      txt: window.__redox.demiEq(q)
        .replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<sup>(.*?)<\/sup>/g, '$1')
        .replace(/<[^>]+>/g, '')
    })));
  for (const l of lignes) {
    const gauche = l.txt.split(' = ')[0];
    const n = (gauche.match(/H\+/g) || []).length;
    assert.equal(n, l.h ? 1 : 0, `« ${l.txt} » porte ${n} terme(s) en H+`);
  }
  /* et les trois formes typiques, mot pour mot */
  const attendu = {
    'H+ / H2':        '2 H+ + 2 e− = H2',
    'MnO4− / Mn2+':   'MnO4− + 8 H+ + 5 e− = Mn2+ + 4 H2O',
    'O2 / H2O':       'O2 + 4 H+ + 4 e− = 2 H2O'
  };
  const rendu = await page.evaluate(() => {
    const p = h => h.replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<sup>(.*?)<\/sup>/g, '$1').replace(/<[^>]+>/g, '');
    const o = {};
    for (const q of window.__redox.EQUIL) o[p(q.ox) + ' / ' + p(q.rd)] = p(window.__redox.demiEq(q));
    return o;
  });
  for (const k of Object.keys(attendu)) assert.equal(rendu[k], attendu[k], k);
  await ctx.close();
});

/* ═══════════════════════════════════════════════════════════════════
   Un énoncé doit déterminer sa réponse.
   L'entraîneur 2d tirait deux COUPLES et n'affichait que les deux
   ESPÈCES. O₂ étant l'oxydant de deux couples de la table, l'un
   au-dessus de Br₂/Br⁻ et l'autre en dessous, le même énoncé rendu
   attendait tantôt « oui », tantôt « non ».
   ═══════════════════════════════════════════════════════════════════ */
test('deux tirages au même énoncé ont la même réponse attendue', async () => {
  const { ctx, page } = await open();
  const collision = await page.evaluate(() => {
    const vus = new Map();
    for (let i = 0; i < 200000; i++) {
      const Q = window.__redox.GEN['2d']();
      const vu = vus.get(Q.q);
      if (!vu) { vus.set(Q.q, Q.sol); continue; }
      if (vu.ok !== Q.sol.ok || Math.abs(vu.d - Q.sol.d) > 1e-9)
        return { q: Q.q.replace(/<[^>]+>/g, ''), a: vu, b: Q.sol };
    }
    return null;
  });
  assert.equal(collision, null, JSON.stringify(collision));
  /* et l'énoncé nomme bien les deux couples, pas seulement les deux espèces */
  const manque = await page.evaluate(() => {
    for (let i = 0; i < 400; i++) {
      const Q = window.__redox.GEN['2d']();
      const couples = (Q.q.match(/\//g) || []).length;
      if (couples < 2) return Q.q.replace(/<[^>]+>/g, '');
    }
    return null;
  });
  assert.equal(manque, null, 'chaque énoncé cite les deux couples');
  await ctx.close();
});

/* La réserve de spéciation valait pour des cations métalliques ; elle était
   servie aux neuf réducteurs du banc, donc à H₂, à Cl⁻, à SO₂ et à NO.     */
test('la remarque d\'hydroxyde ne vise que les espèces qui en forment', async () => {
  const { ctx, page } = await open();
  const vu = await page.evaluate(() => {
    const especes = {}; let sansReserve = 0;
    for (let i = 0; i < 60000; i++) {
      const Q = window.__redox.GEN['2c']();
      if (Q.corr.indexOf('n\'affirme rien sur les espèces réellement présentes') < 0) sansReserve++;
      const i2 = Q.corr.indexOf('</span> précipiterait');
      if (i2 < 0) continue;
      const avant = Q.corr.slice(0, i2);
      const sp = avant.slice(avant.lastIndexOf('<span class="f">') + 16);
      especes[sp] = (especes[sp] || 0) + 1;
    }
    return { especes: Object.keys(especes).sort(), sansReserve };
  });
  assert.deepEqual(vu.especes, ['Cr<sup>3+</sup>', 'Mn<sup>2+</sup>'],
    'seuls les deux cations métalliques du banc');
  assert.equal(vu.sansReserve, 0, 'la réserve générale, elle, est toujours là');
  await ctx.close();
});
