# Site de révision REDOX — brief de construction

> **À lire en premier, avant toute ligne de code.** Ce fichier contient tout ce
> qui a été décidé avec Yannick au cours de la phase de conception. Rien de ce
> qui suit n'est à rouvrir : ce sont des décisions prises, pas des options.
>
> Les maquettes validées sont dans `design/`. Ce sont les **spécifications
> visuelles de référence** : ouvre-les et reprends leur CSS, ne réinvente pas.

---

## 1. L'objectif

Construire **`redox.html`** à la racine de ce dépôt : un site de révision
complet sur l'oxydoréduction, **fichier unique, 100 % hors ligne**, sur le
modèle de ce qui a été fait pour le dossier ONDES
(`../../PHYSIQUE/ONDES/ondes.html`) — mais **avec une architecture et un design
propres à la chimie**, pas un copier-coller.

---

## 2. L'étudiant — ce qui commande tout

- **Il redouble cette UE.** Il l'a déjà ratée une fois.
- **Son point noir : le calcul de la loi de Nernst.** Pas la théorie, le calcul.
- **Il n'a pas compris comment tracer le diagramme E-pH.** Il a dit :
  « tout à partir de la loi de Nernst mérite renforcement approfondi ».
- **Niveau de maths à supposer : 3ᵉ, avec des lacunes.** Le logarithme doit être
  expliqué de zéro. Ne jamais supposer acquis : puissances de 10, log, `pH = −log[H⁺]`,
  fonction affine `y = ax + b`.
- **Calculatrice : TI-Nspire CX CAS II.** Il veut les séquences de touches.
- **Le site doit couvrir TOUT le cours**, pas seulement la zone difficile.
  Il l'a explicitement rappelé.
- Langue : français. Tutoiement (c'est le registre du site Ondes).

---

## 3. Le dossier source

| Fichier | Contenu |
|---|---|
| `Cours.pdf` | Cours magistral, **73 diapositives**, 3 chapitres |
| `cours_bonus.pdf` | **67 diapositives** — même plan **plus un chapitre : corrosion et passivation** |
| `Diagramme E-pH fer.pdf` | Le diagramme du fer, 5 domaines et 7 frontières |
| `CC1 2025.pdf` + correction | Sujet 2025 |
| `cc1/CC1.pdf` + correction | Sujet 2024 |
| `cc2/cc2.pdf` + correction | Sujet 2023 |
| `cc3/cc3.pdf` + correction | Sujet 2022 |

Le texte des deux cours est déjà extrait dans `design/cours-extrait.txt` et
`design/cours-bonus-extrait.txt` (`pdftotext -layout`). **Les corrigés sont des
scans manuscrits** : ils devront être retranscrits en texte (décision validée).

### Constat majeur : le contrôle est le même depuis quatre ans

Ce n'est pas « le même genre de sujet » — c'est le **même squelette**, exercice
par exercice, avec d'autres espèces chimiques :

1. **Définitions** — oxydation, réduction, dismutation, écritures conventionnelles
2. **n.o. + équilibrage** — n.o. de 4 espèces ; couple dans le sens conventionnel ;
   équilibrer **en milieu acide puis basique** ; qui s'est réduit ; dismutation de
   H₂O₂ ; « ces deux espèces peuvent-elles réagir ? »
3. **Pile** — ions en solution ; réactions anode/cathode ; schéma annoté (signes,
   sens des e⁻, sens du courant) ; écriture symbolique ; rôle du pont ; fem
4. **Loi de Nernst** — écrire Nernst pour un couple, calculer E à un pH imposé
5. **Diagramme E-pH** — placer les espèces, justifier, exploiter des coordonnées

C'est ce constat qui justifie l'architecture ci-dessous.

---

## 4. L'architecture validée — le parcours en 17 étapes

**Un seul fil.** Yannick a demandé les deux entrées (cours complet + gestes)
« combinées pour que tout soit bien linéaire ». La réponse retenue :

- Le **cours dans son ordre naturel**, numéroté **0 → 16**, avec un bouton
  « suivant » en bas de chaque page.
- Les **5 gestes ne sont pas un site parallèle** : ils sont **posés dans le fil**,
  à l'endroit exact où le cours vient de donner ce qu'il faut pour les exécuter.
- Une **bascule dans le menu** (`Le fil` / `Les 5 gestes`) rebascule le même
  contenu en index de révision, qui pointe vers les mêmes pages.
- Jamais deux endroits où chercher la même chose.

### Le fil complet

| # | Étape | Geste | Diapos |
|---|---|---|---|
| **0** | **Boîte à outils maths** — puissances de 10, log comme compteur de zéros, log(a·b), pH = −log[H⁺], y = ax + b, la TI-Nspire | socle | *ajout* |
| | **Chapitre 1 — Les réactions rédox** | | |
| 1 | Introduction — Lavoisier, à quoi sert le rédox | | 3–4 |
| 2 | Oxydant, réducteur, couple rédox, demi-équation | geste 1 | 5–11 |
| 3 | Nombre d'oxydation — les 7 règles | geste 2a | 12–14 |
| 4 | Équilibrer une demi-équation — la méthode en 5 temps | geste 2b | 15–19 |
| 5 | Équilibrer une équation — acide puis **basique** | geste 2c | 20–24 |
| 6 | Dismutation — le cas de H₂O₂ | geste 1 | 25–26 |
| | **Chapitre 2 — Les piles** | | |
| 7 | Cellule électrochimique — anode, cathode, signes, sens | geste 3 | 28–36 |
| 8 | Rôle du pont salin | geste 3 | 37–43 |
| 9 | Force électromotrice | geste 3 | 44–45 |
| 10 | Pile Daniell, électrolyse comme pile inversée | geste 3 | 46–47 |
| | **Chapitre 3 — Potentiels et diagrammes** | | |
| 11 | Potentiel d'électrode E et E° — ESH, table des 21 couples | | 49–52 |
| 12 | **Loi de Nernst** — le calcul en entier | geste 4 | 60–66 |
| 13 | Sens spontané et règle du γ | geste 2d | 53–59 |
| 14 | **Diagramme potentiel-pH** — domaines, frontières, tracé | geste 5 | 67–73 |
| 15 | Corrosion, immunité, passivation — les couples de l'eau | | **bonus** 60–67 |
| | **Pour finir** | | |
| 16 | Les 4 annales, sujets et corrigés retranscrits, chronométrables | révision | |

L'**étape 0** est la seule addition au dossier : sans elle, les étapes 12 et 14
restent inaccessibles. Les **étapes 11 → 14** sont la zone signalée par
Yannick : ce sont les plus travaillées.

### L'anatomie d'une page (voir `design/maquette-parcours.html`)

1. **Le fil** — barre de 17 étapes en haut, toujours visible : position,
   pourcentage, nombre de faits vérifiés.
2. **Le plan avec bascule** — menu numéroté 0 → 16, bouton « Les 5 gestes ».
3. **La chaîne du calcul** — tout calcul est décomposé en maillons numérotés ;
   colonne de droite = **la maths de niveau 3ᵉ qui débloque l'étape**. Le dernier
   maillon fait toujours la **passerelle vers l'étape suivante du parcours**.
4. **Le bloc geste** — posé dans le fil juste après la théorie qui le rend
   exécutable : recette numérotée, piège, années où c'est tombé, entraîneur.
5. **La paillasse** — dock ancré en bas, 4 outils pré-remplis avec le couple lu :
   *échelle des E° · calculateur Nernst · traceur E-pH · vérifier mon calcul*.

---

## 5. Les décisions déjà prises

Validées explicitement par Yannick — **ne pas rouvrir** :

| # | Décision |
|---|---|
| 1 | **Les deux chemins**, combinés en un fil linéaire unique |
| 2 | **Boîte à outils maths** en étape 0, en supposant zéro acquis |
| 3 | **Mode « vérifier mon calcul »** avec la séquence de touches TI-Nspire complète |
| 4 | **Retranscription des 4 corrigés de CC** (scans manuscrits → texte) |
| 5 | **Points de contrôle** comme sur Ondes, mais souvent des **mini-calculs** plutôt que des QCM |
| — | Direction visuelle : **mix des directions 01 + 03 + 04** de `design/maquette-4-directions.html` |
| — | **Fractions empilées** partout (voir §6) — la fraction typographique est rejetée |

---

## 6. Les composants de design

**Reprendre le CSS depuis les fichiers de `design/`, ne pas réécrire.**

### Fraction empilée — `design/maquette-fractions.html`

Numérateur seul en haut, barre pleine, dénominateur seul en bas. Yannick a
rejeté explicitement la fraction typographique (`⁰'⁰⁶⁄ₙ`) : illisible.

```css
.fr{display:inline-block;vertical-align:middle;text-align:center;
    margin:0 .24em;line-height:1.24;white-space:nowrap}
.fr>.n{display:block;padding:0 .38em .12em;border-bottom:1.15px solid currentColor}
.fr>.d{display:block;padding:.14em .38em 0}
.fr .fr{font-size:.92em}          /* imbriquée : un cran plus petit */
.op{vertical-align:middle}        /* « log » se centre sur la fraction */
.expr{line-height:2.6}            /* les lignes d'équation respirent */
```

```html
<span class="fr"><span class="n">0,06</span><span class="d">n</span></span>
```

Quatre règles : la barre se cale sur l'**axe des maths** (pas la ligne de base) ;
elle prend la **largeur du plus large des deux étages** ; les lignes d'équation
reçoivent un interligne de 2,6–2,9 ; une fraction imbriquée rétrécit.
Le catalogue des **11 cas réels du cours** est rendu dans le fichier.

### Notation chimique

```css
.f{white-space:nowrap;text-transform:none!important}
.f sub{font-size:.68em;vertical-align:-.25em}
.f sup{font-size:.68em;vertical-align:.42em}
.f .st{font-size:.72em;opacity:.6}     /* (s) (aq) (g) */
.ox{color:#8E2F6B}   /* espèce oxydée */
.rd{color:#1B5E8E}   /* espèce réduite */
.el{color:#A05B00}   /* électrons */
```

### Palette et polices

Palette tirée des **couleurs réelles des espèces** du cours :

```
--acc  #6E2A8F   violet permanganate (accent principal)
--ox   #8E2F6B   oxydé      --rd  #1B5E8E   réduit
--el   #A05B00   électrons, valeurs numériques
--mark #B3352A   pièges, corrections
--ok   #1C6B44   validé
papier #FCFCFA   encre #17181C   gris #6A6D75   filet #E6E5E0
```

**Polices système uniquement** (contrainte hors ligne, aucun téléchargement) :
`ui-serif` (New York) pour le texte de cours et les formules · `-apple-system`
(SF Pro) pour l'interface, la navigation et les blocs gestes · `ui-monospace`
(SF Mono) pour les nombres, les données et les étiquettes.

---

## 7. Conventions non négociables

Apprises sur le site Ondes, ou spécifiques à la chimie :

1. **Jamais de `text-transform: uppercase` sur une formule ou sur « pH ».**
   En chimie la casse porte du sens : `Co` (cobalt) ≠ `CO` (monoxyde de carbone),
   `MnO₄⁻` ≠ `MNO₄⁻`, `pH` ≠ `PH`. Les deux bugs ont été trouvés en maquette.
2. **Mesure de lecture ≈ 66 signes** (`34em`). Pas de colonne à 120 signes.
3. **Trois niveaux d'encadré au maximum** — définition, formule, piège.
   Pas de soupe d'aplats colorés. Filets et étiquettes, pas de fonds.
4. **Le gras est rare** : au plus un par segment de phrase, sur le terme qu'on
   cherchera en révision. Jamais sur une clause entière.
5. **Pas d'emoji dans les titres.** La hiérarchie passe par la typographie.
   (Ils restent admis dans le menu, comme repère de position.)
6. **Points de contrôle = compréhension, pas lecture.** La réponse ne doit être
   lisible nulle part dans le paragraphe. Cinq formes admises : transfert,
   prédiction, discrimination, inversion, contre-exemple. Un test automatique
   doit refuser toute question dont la bonne réponse est la seule des options à
   figurer dans le paragraphe.
7. **Rien ne bouge tant qu'on ne clique pas** : au repos un point de contrôle
   n'est qu'une pastille en fin de phrase. À vérifier par test (< 3 % de
   variation de hauteur de page).
8. **Thème sombre** dès le départ, via jetons CSS, avec bascule persistée.
9. **Impression** : seule la page affichée, jamais les 17.
10. **`prefers-reduced-motion`** respecté si des animations sont ajoutées.

---

## 8. Données de référence

### Table des potentiels standards (diapo 46 du bonus), 25 °C

```
F2/F-          2,87     ← oxydant le plus fort
H2O2/H2O       1,77
PbO2/PbSO4     1,70
MnO4-/Mn2+     1,51
Cl2/Cl-        1,36
Cr2O7 2-/Cr3+  1,33
O2/H2O         1,23
Br2/Br-        1,06
NO3-/NO        0,96
Ag+/Ag         0,80
Fe3+/Fe2+      0,77
O2/H2O2        0,68
I2/I-          0,62
Cu2+/Cu        0,34
Sn4+/Sn2+      0,13
H+/H2          0        ← électrode de référence (ESH)
Pb2+/Pb       -0,13
Sn2+/Sn       -0,14
PbSO4/Pb      -0,31
Fe2+/Fe       -0,44
Zn2+/Zn       -0,76     ← réducteur le plus fort
```

⚠️ **Incohérence repérée dans le cours** : la diapo 61 du bonus donne
`E°(O2/H2O) = 0,68 V` alors que la table donne `1,23 V` (0,68 est celui de
`O2/H2O2`). À vérifier sur le PDF avant d'écrire l'étape 15, et à signaler dans
le site plutôt qu'à propager en silence.

### Calculs de référence, vérifiés

**MnO₄⁻/Mn²⁺** — E° = 1,51 V, demi-équation `MnO4- + 8H+ + 5e- = Mn2+ + 4H2O`

```
E = 1,51 + (0,06/5)·log([MnO4-]/[Mn2+]) − (0,06/5)·8·pH
E = 1,51 + 0,012·log(...) − 0,096·pH
[MnO4-]=1e-3, [Mn2+]=1e-1, pH=2  →  E = 1,29 V
frontière du diagramme :          E = 1,486 − 0,096·pH
                                  pH 0 → 1,49  ·  pH 14 → 0,14
```

**HSO₄⁻/SO₂** — sujet 2024, E° = 0,17 V, `HSO4- + 3H+ + 2e- = SO2 + 2H2O`

```
E = E° + 0,03·log([HSO4-]/[SO2]) − 0,09·pH
[HSO4-]=[SO2]=1e-2 → log(1) = 0, le terme disparaît
pH = 3  →  E = 0,17 − 0,27 = −0,10 V
```

Ce second cas est pédagogiquement précieux : concentrations égales ⟹ `log(1) = 0`.

### Méthode d'équilibrage (diapo 17 du bonus), à respecter mot pour mot

1. Écrire la demi-équation dans le sens conventionnel (`Ox + ne = Red`)
2. Ajuster les éléments autres que H et O
3. Ajuster l'oxygène avec `H2O`
4. Ajuster l'hydrogène avec `H+` (le milieu est acide par défaut)
5. Équilibrer les charges avec les électrons
6. Vérification : la différence de n.o. de l'élément réduit = nombre d'électrons

Passage en **milieu basique** : ajouter autant de `OH-` que de `H+` des deux
côtés, recombiner en `H2O`. C'est demandé à chaque sujet.

---

## 9. L'ordre des travaux

1. ~~**Le squelette et le fil**~~ — **fait.** 17 étapes, navigation linéaire,
   bascule des gestes, paillasse à quatre onglets, jetons CSS, thème à trois
   états. L'**étape 12 est écrite en entier** et sert d'implémentation de
   référence : chaîne du calcul, fractions empilées, bloc geste, trois points
   de contrôle, panneau TI-Nspire. Les seize autres étapes portent leur
   objectif et leur note de chantier.
2. **Le cours en entier** — chapitres 1 à 3 plus la corrosion, avec les figures
   redessinées : schéma de pile annoté, échelle des E°, diagramme E-pH du fer.
3. **L'étape 0** — la boîte à outils maths, écrite en supposant zéro acquis.
4. **Les quatre outils de la paillasse** — dont le traceur E-pH (le morceau de
   bravoure) et le vérificateur TI-Nspire.
5. **Les 5 gestes et leurs entraîneurs** — tirage aléatoire et correction.
6. **Les 4 annales retranscrites** — sujets et corrigés, chronométrables.
7. **Les points de contrôle** et les tests de non-régression.

---

## 10. État du dépôt et pièges

- Dépôt **`ycklsr/ut3-redox`**, privé, branche `main`. Les 12 PDF sont versionnés.
- Le site est **`redox.html`** à la racine — fichier unique, aucune dépendance.
- **Tests** : `npm test` (Playwright + `node --test`, 18 tests dans
  `tests/squelette.test.mjs`), branchés en `pre-commit` par `npm install`
  (script `prepare` → `core.hooksPath githooks`) et en CI par
  `.github/workflows/tests.yml`. Sur une machine neuve :
  `npm install && npx playwright install chromium`.
- **Contrôle visuel** : `npm run captures` rend neuf vues clés en clair et en
  sombre dans un dossier temporaire. À relire à l'œil après toute modification
  de mise en page — les tests vérifient la mécanique, pas l'allure.
- Trois gardes automatiques valent la peine d'être connues avant d'écrire :
  aucune capitalisation forcée sur une formule ni sur « pH » (elle a déjà
  attrapé un `E-pH` rendu `E-PH`), aucun débordement horizontal de 375 à
  1280 px, et un contraste d'au moins 4,5:1 sur fond accent dans les deux
  thèmes.
- **Une formule ne se coupe pas.** `.f` est en `nowrap` ; quand une expression
  dépasse, c'est `.formula .e` ou `.link .expr` qui défile, jamais la page.
  Toute nouvelle expression longue doit être dans un de ces deux conteneurs.
- ⚠️ **Ne pas toucher au dépôt ONDES** (`../../PHYSIQUE/ONDES`) : une autre
  session Claude y travaille (conversation forkée) et y a du travail non commité.
- Les maquettes sont aussi publiées comme artefacts consultables :
  - parcours final — `https://claude.ai/code/artifact/937d03d3-c7aa-431e-afb3-8a94c901313a`
  - fractions — `https://claude.ai/code/artifact/35f03ae4-392c-4061-a0fe-9f202b8edf7a`
  - les 4 directions — `https://claude.ai/code/artifact/f805d91e-cbdc-4a3b-a780-dfdf51ad67f8`

---

## 11. Pour reprendre

> Lis `PLAN.md`, ouvre `redox.html` à l'étape 12 — c'est l'implémentation de
> référence, tout le reste s'écrit sur ce modèle — et prends le point 2 de
> l'ordre des travaux. Chaque étape porte déjà sa note de chantier : elle dit
> ce qui doit y être écrit.
