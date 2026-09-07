# Proposition pédagogique — progression guidée

Écrite sur la branche `pedagogie/progression-guidee`, issue de `main` au commit
`05f579815739f77c112fd8c542864c8a44ebab56`, relue sur macOS, puis fusionnée
dans `main`. La branche a été supprimée après fusion : tout est dans `main`.

## Le problème observé

Le contrôle « 3 électrons / 2 électrons » était à l'étape 2. La méthode de
combinaison et son exemple étaient à l'étape 5. Il fallait donc découvrir
le raisonnement en répondant à une question censée le vérifier.

D'autres écarts du même type existaient : opérations sur les puissances
avant le tableau des règles, nombre d'oxydation du soufre avant les règles,
passage au milieu basique avant sa méthode, dismutation spontanée avant les
potentiels. Une question sur `n = 4` et une variation de n.o. de 2 omettait
le nombre d'atomes et ne permettait pas de conclure de façon unique.

## Progression retenue

Pour les difficultés retravaillées : **explication → exemple résolu → essai
guidé → contrôle de transfert**. Un contrôle ne sert plus à introduire une
opération nouvelle. Les nombres varient entre les exemples, les essais et
les contrôles ; le corrigé complet du cas 3/2 reste consultable à la demande.

Les onze essais comprennent 26 réponses intermédiaires. Ils ne comptent
pas comme des « faits vérifiés ». Une erreur permet de réessayer ; deux
niveaux d'indice sont disponibles ; « Recommencer » remet uniquement cet
essai à zéro. La suite du parcours reste libre : l'étudiant peut aussi
réviser directement une étape sans réussir tous les essais précédents.

## Modifications dans le parcours

| Étape | Changement |
| --- | --- |
| 0 — Maths | Puissance de puissance expliquée puis exercée ; pente et ordonnée à l'origine distinguées avant le contrôle ; retour du logarithme au nombre explicité. Correction de `b = E₁ − a × pH₁`. |
| 2 — Couples | Le contrôle porte sur l'annulation d'électrons déjà en nombres égaux. Le geste de lecture d'un couple utilise une demi-équation fournie, sans exiger les nombres d'oxydation de l'étape suivante. |
| 3 — Nombres d'oxydation | Règles et exemple d'équation à une inconnue avant le transfert au soufre. Essai guidé sur le carbonate. Distinction entre « plus oxydé » et « oxydant plus fort ». |
| 4 — Demi-équations | Variation de n.o. par atome, puis multiplication par le nombre d'atomes concernés. Exemple Cl₂, essai O₂, transfert au dichromate. Contrôle ambigu remplacé. |
| 5 — Équations | Définition d'un multiple commun, cas 2/4 expliqué, cas 2/6 guidé, multiplication de tous les coefficients sur Cu²⁺/Cu, contrôle autonome 3/2, puis essai 4/6. Conversion basique décomposée en ajout, recombinaison, simplification avant les contrôles. |
| 6 et 13 — Dismutation | Reconnaissance et équilibrage à l'étape 6 ; prévision thermodynamique déplacée à l'étape 13. Les E° sont donnés dans l'entraîneur, qui demande l'écart ΔE° et non le recopiage d'un potentiel affiché ; conditions standard et absence de conclusion sur la vitesse sont explicites. Le geste, devenu voisin du geste 2d, passe de `1b` à `2e`. |
| 12 — Nernst | Premier calcul sans H⁺ sur Fe³⁺/Fe²⁺ : rapport, logarithme, correction, potentiel. Quatre réponses guidées avant le calcul plus chargé du permanganate. Le contrôle sur le pH nomme explicitement le couple et les données fixes. |
| 14 — E-pH | Signe, rapport protons/électrons et multiplication séparés avant le contrôle de pente. Question sur le domaine de validité d'une frontière précisée. |

Pour le cas signalé, le raisonnement attendu est désormais visible : trouver
un total commun, diviser ce total par le nombre d'électrons de chaque
demi-équation, multiplier **tous** les coefficients, puis vérifier
l'annulation. Le cas 4/6 distingue un total commun valide (24) du plus petit
(12) : un choix non minimal n'est pas présenté comme une impossibilité
chimique.

## Périmètre et conventions

Les 17 étapes, les 10 blocs gestes, les quatre annales, les outils de la
paillasse et le fonctionnement hors ligne sont conservés. Aucune bibliothèque
ni ressource réseau n'est ajoutée au HTML. Les nouvelles interactions sont
isolées de l'état des contrôles et des outils. Les identifiants des questions
dont le sens change sont renouvelés pour ne pas réutiliser d'anciennes
validations à tort.

Les calculs de Nernst reprennent l'approximation `0,06 V` du cours à 25 °C.
Pour les ions dissous des nouveaux exemples, les activités sont assimilées
aux concentrations rapportées à `1 mol·L⁻¹`. Le calcul `nombre d'atomes ×
variation de n.o.` est présenté pour une demi-équation où un seul élément
change de nombre d'oxydation. L'absence de H⁺ après conversion basique est
nécessaire dans les exercices concernés, mais ne remplace pas les bilans
d'atomes et de charges.

## Vérification technique

```sh
npm ci
npx playwright install --with-deps chromium
npm test
```

`tests/pedagogie.test.mjs` ajoute 16 tests aux 76 autres — 92 en tout : ordre effectif
exemples/essais/contrôles, emplacement des activités, résultats recalculés
indépendamment, réponses vides et mal formées, indices, nouvel essai,
réinitialisation, indépendance du compteur, conservation des charges et
atomes, données fournies aux entraîneurs et anciennes validations. Les
nouveaux blocs sont exercés à 320, 375 et 1280 pixels en clair et en sombre.
L'ouverture directe du fichier est testée sans requête HTTP externe.

## Corrections apportées à la relecture

La première version de cette branche a été relue sur macOS, où le site est lu.
Onze défauts y ont été corrigés — le détail est dans le commit de relecture.
Le plus important : la formule de ΔE° tenait dans un `span.f` insécable et
débordait de 18 px à 375 px, ce que la CI n'a pas vu parce que le runner Linux
n'a pas les polices Apple et rend le même texte 25 px plus étroit. Le bouton
primaire des onze essais n'avait aucun style de bouton — le site remet tous ses
boutons à zéro et les rhabille par une règle dédiée, que `.practice` n'avait
pas. Les deux entraîneurs de gestes touchés livraient leur propre réponse. Rien
n'était prévu pour l'impression, et 87 apostrophes courbes cohabitaient avec les
4 700 droites du fichier.

Ces vérifications protègent la cohérence et le fonctionnement de la
proposition. Elles ne mesurent pas un gain d'apprentissage. Une validation
avec l'étudiant reste nécessaire : lui demander d'expliquer pourquoi il
choisit les multiplicateurs, puis lui faire traiter un autre couple de
nombres sans indices. Cette proposition ne prétend pas que chaque question
du site a été réécrite ou que tous les implicites du cours ont disparu.
