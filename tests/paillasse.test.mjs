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

/* Le tableau de valeurs ne dit rien du dessin. Une version de ce traceur
   ramenait les ordonnées hors cadre sur le bord, puis reliait les points
   déplacés : la pente dessinée devenait −0,166 pour une droite à −0,18,
   et le graphique contredisait son propre tableau. On lit donc la pente
   SUR le chemin SVG, et on vérifie que le trait s'arrête au bon pH.    */
test('le trait dessiné a la pente saisie, même quand la droite sort du cadre', async () => {
  const { ctx, page } = await open('eph');
  await page.click('#eph-m2');
  const cas = [[-0.18, 1.13, 12.944], [-0.06, 0, 14], [0.06, 0.5, 14], [-0.3, 1.5, 9], [-0.096, 1.486, 14]];
  const fautes = [];
  for (const [a, b, phFin] of cas) {
    await set(page, '#eph-a', a); await set(page, '#eph-b', b);
    const t = await page.evaluate(() => {
      const acc = [...document.querySelectorAll('#eph-fig svg path')]
        .find(p => /var\(--acc\)/.test(p.getAttribute('style') || ''));
      if (!acc) return null;
      const m = acc.getAttribute('d').match(/M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)/);
      if (!m) return null;
      /* le repère du traceur, recopié ici pour ne rien lui emprunter */
      const L = 52, R = 596, T = 16, B = 250, EM = 1.6, Em = -1.2;
      const n = m.slice(1).map(Number);
      const pH = x => (x - L) * 14 / (R - L), E = y => EM - (y - T) * (EM - Em) / (B - T);
      return { ph1: pH(n[0]), e1: E(n[1]), ph2: pH(n[2]), e2: E(n[3]) };
    });
    if (!t) { fautes.push(`a=${a} : aucun trait dessiné`); continue; }
    const pente = (t.e2 - t.e1) / (t.ph2 - t.ph1);
    if (Math.abs(pente - a) > 2e-3) fautes.push(`a=${a} : pente dessinée ${pente.toFixed(4)}`);
    if (Math.abs(t.ph2 - phFin) > 0.05) fautes.push(`a=${a} : le trait s'arrête à pH ${t.ph2.toFixed(2)}, attendu ${phFin}`);
    /* le trait doit rester dans la bande, sans jamais la dépasser */
    for (const e of [t.e1, t.e2]) if (e < -1.2 - 1e-6 || e > 1.6 + 1e-6) fautes.push(`a=${a} : un point à ${e.toFixed(3)} V, hors cadre`);
    /* et il doit coïncider avec l'équation, pas seulement avoir sa pente */
    const milieu = (t.ph1 + t.ph2) / 2;
    const attendu = b + a * milieu, dessine = t.e1 + pente * (milieu - t.ph1);
    if (Math.abs(attendu - dessine) > 5e-3) fautes.push(`a=${a} : à pH ${milieu.toFixed(1)} le trait donne ${dessine.toFixed(3)} au lieu de ${attendu.toFixed(3)}`);
  }
  assert.deepEqual(fautes, []);
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

/* Le mode « autre couple » a longtemps figé les exposants à 1, interdit un
   solide et supposé les protons du côté de l'oxydant. Il ne pouvait donc
   pas représenter la frontière Cu²⁺/Cu₂O du sujet 2022, pourtant traitée
   dans le site, dont le coefficient directeur vaut +0,06.               */
test('le calculateur couvre un solide, des coefficients et des protons côté réducteur', async () => {
  const { ctx, page } = await open('ner');
  await page.selectOption('#ner-c', '*');
  await set(page, '#ner-e0', 0.203); await set(page, '#ner-n', 2); await set(page, '#ner-h', 2);
  await page.selectOption('#ner-cote', 'rd');
  await set(page, '#ner-oxp', 2); await set(page, '#ner-rdp', 0);
  const vu = await page.evaluate(() => ({
    rdMasque: document.getElementById('ner-rd-fld').hidden,
    demi: (document.querySelector('#ner-out .e2') || {}).textContent || '',
    texte: document.getElementById('ner-out').textContent.replace(/\s+/g, ' ')
  }));
  assert.equal(vu.rdMasque, true, 'un réducteur de coefficient 0 sort du log, son champ se masque');
  assert.match(vu.demi, /2 Ox.*2 e−.*=.*Red.*2 H\+/, 'la demi-équation reconstruite porte les coefficients et les protons à droite');
  assert.match(vu.texte, /\+ 0,06 · pH/, 'la pente est positive');
  /* le calcul lui-même, recalculé ici sans passer par l'interface */
  const a = await page.evaluate(() => window.__redox.nernst({ e0: 0.203, n: 2, h: 2, oxP: 2, rdP: 0, hCote: 'rd' }, 1e-2, 1, 0).a);
  assert.ok(Math.abs(a - 0.06) < 1e-12, 'pente +0,06 : ' + a);
  /* et les vingt-cinq couples de la table gardent la leur */
  const fautes = await page.evaluate(() => window.__redox.COUPLES
    .map(c => ({ key: c.key, a: window.__redox.nernst(c, 1, 1, 0).a, attendu: -0.06 * c.h / c.n }))
    .filter(x => Math.abs(x.a - x.attendu) > 1e-12)
    .map(x => x.key + ' : ' + x.a + ' au lieu de ' + x.attendu));
  assert.deepEqual(fautes, [], 'aucun couple de la table ne change de pente');
  await ctx.close();
});

/* Deux exposants collés se lisent comme un seul : [F⁻]² à 10⁻¹ s'écrivait
   « 10⁻¹² », soit 10⁻¹² au lieu de (10⁻¹)². Cinq couples de la table sont
   concernés. Le terme des protons était déjà parenthésé ; les deux autres
   ne l'étaient pas.                                                      */
test('une concentration élevée à une puissance est parenthésée', async () => {
  const { ctx, page } = await open('ner');
  const touches = await page.evaluate(() => window.__redox.COUPLES.filter(c => c.oxP > 1 || c.rdP > 1).map(c => c.key));
  assert.ok(touches.length >= 5, 'au moins cinq couples ont un exposant supérieur à 1');
  const fautes = [];
  for (const k of touches) {
    await pick(page, '#ner-c', k);
    await page.evaluate(() => {
      for (const [id, v] of [['ner-oxm', '1'], ['ner-rdm', '1'], ['ner-oxe', '-1'], ['ner-rde', '-1']]) {
        const e = document.getElementById(id);
        if (e && e.offsetParent) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
      }
    });
    const html = await page.evaluate(() => [...document.querySelectorAll('#ner-out .e2')].map(e => e.innerHTML).join(' '));
    /* deux <sup> qui se suivent immédiatement : les exposants se télescopent */
    if (/<\/sup>\s*<sup>/.test(html)) fautes.push(k + ' : deux exposants collés');
    const txt = await page.evaluate(() => [...document.querySelectorAll('#ner-out .e2')].map(e => e.textContent).join(' '));
    if (/10−\d\d(?!\))/.test(txt) && !/\(10−\d\)/.test(txt)) fautes.push(k + ' : « ' + txt.match(/10−\d\d/)[0] +' » se lit comme un seul exposant');
  }
  assert.deepEqual(fautes, []);
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
    for (const t of ['eqb', 'ech', 'ner', 'eph', 'ti']) {
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

/* ═══════════════════════════════════════════════════════════════════
   La séquence de touches et le moteur doivent dire le MÊME nombre.
   L'ancien test comptait les touches : il voyait « 10ˣ », « ▶ » et deux
   « ctrl », et déclarait la séquence cohérente. Elle ne l'était pas —
   l'exposant stœchiométrique n'était jamais tapé, et pour Cl₂/Cl⁻ à
   [Cl⁻] = 10⁻¹ les touches donnaient 1,39 V là où le moteur annonçait
   1,42 V. On évalue donc l'expression que les touches construisent.
   ═══════════════════════════════════════════════════════════════════ */

/* traduit la séquence en expression : ^ ouvre un exposant, ▶ le referme,
   ctrl + 10ˣ est le logarithme décimal, ctrl + enter clôt la saisie */
function evalueTouches(keys) {
  let e = '', i = 0;
  while (i < keys.length) {
    const k = keys[i];
    if (k === 'ctrl') {
      const suite = keys[i + 1];
      if (suite === '10ˣ') { e += 'Math.log10('; i += 2; continue; }
      if (suite === 'enter') { i += 2; continue; }
      throw new Error('ctrl suivi de « ' + suite +' »');
    }
    if (k === '(−)') e += '-';
    else if (k === '^') e += '**(';
    else if (k === '▶') e += ')';
    else if (k === '×') e += '*';
    else if (k === '÷') e += '/';
    else if (k === '−') e += '-';
    else if (/^[0-9.()+]$/.test(k)) e += k;
    else throw new Error('touche inconnue : « ' + k + ' »');
    i++;
  }
  return { expr: e, valeur: Function('"use strict";return (' + e + ')')() };
}

/* remplit un champ s'il est à l'écran ; les champs cachés ne comptent pas
   dans le calcul (activité 1, ou couple sans protons) */
const setVisible = (page, sel, v) => page.evaluate(([s, val]) => {
  const el = document.querySelector(s);
  if (!el || !el.offsetParent) return false;
  el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); return true;
}, [sel, String(v)]);

test('la séquence de touches calcule bien ce que le moteur annonce', async () => {
  const { ctx, page, errors } = await open('ner');
  const cles = await page.evaluate(() => window.__redox.COUPLES.map(c => c.key));
  /* deux jeux de concentrations : des puissances nues, puis des mantisses —
     c'est la mantisse au dénominateur qui révélait le groupement manquant */
  const jeux = [
    { oxm: 1, oxe: -2, rdm: 1, rde: -1, ph: 3 },
    { oxm: 2, oxe: -1, rdm: 3, rde: -4, ph: 11 }
  ];
  const fautes = [];
  for (const key of cles) {
    for (const j of jeux) {
      await pick(page, '#ner-c', key);
      for (const [k, v] of Object.entries(j)) await setVisible(page, '#ner-' + (k === 'ph' ? 'phn' : k), v);
      const moteur = await page.evaluate(() => {
        const v = window.__redox.nerVals();
        return window.__redox.nernst(v.c, v.ox, v.rd, v.ph).E;
      });
      await page.click('.dock .tab[data-tool="ti"]');
      const keys = await page.$$eval('#ti-out .keys .key', k => k.map(x => x.textContent));
      await page.click('.dock .tab[data-tool="ner"]');
      let lu;
      try { lu = evalueTouches(keys); }
      catch (err) { fautes.push(key + ' · ' + JSON.stringify(j) + ' · ' + err.message); continue; }
      if (Math.abs(lu.valeur - moteur) > 1e-9)
        fautes.push(key + ' · ' + JSON.stringify(j) + ' · les touches donnent ' + lu.valeur
          + ' quand le moteur annonce ' + moteur + ' · « ' + lu.expr + ' »');
    }
  }
  assert.deepEqual(fautes, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('la séquence du couple saisi à la main suit elle aussi le moteur', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', '*');
  /* protons du côté du réducteur : la pente devient positive */
  for (const [sel, v] of [['#ner-e0', 0.203], ['#ner-n', 2], ['#ner-h', 2],
                          ['#ner-oxp', 2], ['#ner-rdp', 0], ['#ner-oxm', 1],
                          ['#ner-oxe', -2], ['#ner-phn', 3]])
    await setVisible(page, sel, v);
  await pick(page, '#ner-cote', 'rd');
  const moteur = await page.evaluate(() => {
    const v = window.__redox.nerVals();
    return window.__redox.nernst(v.c, v.ox, v.rd, v.ph).E;
  });
  assert.ok(Math.abs(moteur - 0.263) < 1e-9, 'le moteur : ' + moteur);
  await page.click('.dock .tab[data-tool="ti"]');
  const keys = await page.$$eval('#ti-out .keys .key', k => k.map(x => x.textContent));
  const lu = evalueTouches(keys);
  assert.ok(Math.abs(lu.valeur - moteur) < 1e-9, 'les touches donnent ' + lu.valeur + ' · « ' + lu.expr + ' »');
  await ctx.close();
});

/* Le panneau TI dépend des champs d'un AUTRE onglet. Il ne se reconstruisait
   que s'il était déjà à l'écran : on revenait dessus sur le calcul d'avant. */
test('l\'onglet TI se reconstruit à son ouverture', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', 'MnO4-/Mn2+');
  await setVisible(page, '#ner-phn', 2);
  await page.click('.dock .tab[data-tool="ti"]');
  const avant = await page.textContent('#ti-out .cmp');
  await page.click('.dock .tab[data-tool="ner"]');
  await setVisible(page, '#ner-phn', 7);
  const moteur = await page.evaluate(() => {
    const v = window.__redox.nerVals();
    return window.__redox.nernst(v.c, v.ox, v.rd, v.ph).E;
  });
  await page.click('.dock .tab[data-tool="ti"]');            /* sans toucher au champ de réponse */
  const apres = await page.textContent('#ti-out .cmp');
  assert.notEqual(apres.replace(/\s+/g, ' '), avant.replace(/\s+/g, ' '), 'le panneau a suivi le changement');
  assert.match(apres, new RegExp(String(moteur.toFixed(3)).replace('.', ',')), 'il annonce ' + moteur);
  await ctx.close();
});

/* Le conseil de signe était écrit pour des protons à gauche. Quand ils sont
   à droite, la pente est positive et « le terme se retranche » renforce la
   faute qu'il prétend diagnostiquer.                                       */
test('le conseil sur le signe du pH suit le côté des protons', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', '*');
  for (const [sel, v] of [['#ner-e0', 0.203], ['#ner-n', 2], ['#ner-h', 2],
                          ['#ner-oxp', 2], ['#ner-rdp', 0], ['#ner-oxm', 1],
                          ['#ner-oxe', -2], ['#ner-phn', 3]])
    await setVisible(page, sel, v);
  await pick(page, '#ner-cote', 'rd');
  await page.click('.dock .tab[data-tool="ti"]');
  await set(page, '#ti-rep', -0.097);                        /* la valeur du signe inversé */
  const d = await page.textContent('#ti-out .diag');
  assert.match(d, /signe du terme en pH inversé/, 'la faute est bien nommée');
  assert.match(d, /s'ajoute/, 'et on lui dit que le terme s\'ajoute');
  assert.doesNotMatch(d, /se retranche/, 'jamais le conseil inverse');
  await ctx.close();
});

/* La séquence affichée sort déjà le pH du log : un ln pressé en la suivant
   ne gonfle que le terme de concentration. Ce cas n'était pas modélisé.    */
test('le ln pressé dans la séquence affichée est reconnu', async () => {
  const { ctx, page } = await open('ner');
  await pick(page, '#ner-c', 'MnO4-/Mn2+');
  for (const [sel, v] of [['#ner-oxm', 1], ['#ner-oxe', -3], ['#ner-rdm', 1],
                          ['#ner-rde', -1], ['#ner-phn', 2]])
    await setVisible(page, sel, v);
  const r = await page.evaluate(() => {
    const v = window.__redox.nerVals();
    return window.__redox.nernst(v.c, v.ox, v.rd, v.ph);
  });
  assert.ok(Math.abs(r.E - 1.294) < 1e-9, 'le calcul de référence : ' + r.E);
  await page.click('.dock .tab[data-tool="ti"]');
  /* ln à la place du log décimal, dans l'expression décomposée */
  await set(page, '#ti-rep', (1.51 + 2.302585 * r.k * r.t + r.a * 2).toFixed(6));
  assert.match(await page.textContent('#ti-out .diag'), /seul terme de concentration/);
  /* et le ln du quotient entier, protons dedans, reste reconnu lui aussi */
  await set(page, '#ti-rep', (1.51 + 2.302585 * (r.k * r.t + r.a * 2)).toFixed(6));
  assert.match(await page.textContent('#ti-out .diag'), /protons compris/);
  await ctx.close();
});
