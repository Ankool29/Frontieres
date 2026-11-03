# Populations animales et migrations

## Architecture examinée

Le code jouable est sur `development` (base examinée : `991e30e`). `main` ne
contient que le README. `ecosystem.js` expose `window.FrontieresEco` ; les pages
`index.html` et `exploration.html` intègrent le même jeu, la seconde ouvrant
immédiatement la vue locale. La carte mesure 144 × 72 territoires, avec longitude
circulaire et latitude bornée. Chaque territoire contient végétation, humidité,
biome, température, arbres, `fauna` et `predators`. Les sous-zones explorées sont
conservées dans `S.subzones`, avec un fond de 225 cases, des modifications et les
cases découvertes. `localStorage` conserve l'état du jeu.

La migration existait déjà à trois endroits : `advance` chaque jour,
`wildlifeStep` toutes les 1,1 secondes et `migrateLocalWildlife` aux bords de la
sous-grille du joueur. Les deux simulations démographiques restaient indépendantes.
Le score herbivore favorisait les voisins déjà peuplés. Le balayage mélangeait les
états avant et après mise à jour ; les plafonds de 12 herbivores et 5 prédateurs
supprimaient des arrivants. Des populations et des proies décoratives pouvaient
apparaître sans parents. Le bouton de simulation locale avançait la date sans
simuler le reste du monde. Les totaux renvoyés ne correspondaient pas aux noms
attendus par l'interface (`herb`/`pred`/`trees`).

## Calcul quotidien proposé

Un seul état d'effectifs, celui du territoire, régit toute la démographie.

1. Faire évoluer climat, humidité, végétation et arbres selon les règles existantes.
2. Comparer les habitats herbivores avec le score `qualité climatique × végétation /
   (herbivores + 1)`. Préparer tous les départs et arrivées avant de les appliquer.
3. Faire ensuite la même opération pour les prédateurs : `qualité climatique ×
   proies / (prédateurs + 0,5)`. Ils voient donc les proies qui viennent de migrer.
4. Consommer le fourrage ; appliquer mortalité, fertilité saisonnière et prédation.
5. Calculer les totaux, événements et compteurs après toutes les opérations.

Les migrations utilisent quatre voisins partageant un bord. Eau, roches et ruines
bloquent le passage ; aucune diagonale ne traverse un détroit. Une amélioration
supérieure à `score actuel × 1,1 + 0,2` évite les mouvements incessants entre
habitats équivalents. La fraction quittant le territoire varie de 15 à 60 % selon
la pression alimentaire ; l'arrondi déterministe permet aussi à un individu isolé
de partir. Un animal ne traverse qu'un territoire par jour. Il n'y a aucune
suppression d'individus à l'arrivée. Les réserves des prédateurs voyagent avec eux,
proportionnellement aux effectifs transférés.

La qualité climatique combine disponibilité d'eau et température saisonnière.
Le fourrage consommé dépend du nombre d'herbivores : 0,65 unité par individu et
par jour en forêt, 1,05 ailleurs. La reproduction conserve six jours de besoins
alimentaires du troupeau et utilise uniquement le surplus. Chaque naissance
consomme douze unités supplémentaires. Les fertilités maximales saisonnières passent
de 4,5/2,5/0,8 % à 2/1,2/0,3 % par jour (printemps/été/automne, zéro en hiver),
avant modulation par l'alimentation et le climat. Cela réduit la croissance rapide
sur le stock de végétation initial. Ces valeurs restent des paramètres de prototype,
pas une calibration biologique par espèce. La mortalité augmente quand les besoins
ne sont pas satisfaits. Aucun plafond d'effectif n'est imposé.

`advance` expose les naissances et morts par catégorie, ainsi que la repousse,
les pertes climatiques, la consommation et le coût alimentaire des naissances.
Le bilan vérifié est : biomasse finale = biomasse initiale + repousse − pertes
climatiques − consommation − coût des naissances. La biomasse est la somme des
unités abstraites de végétation des territoires habitables.

Une chasse fournit 12 unités de réserve ; un prédateur en consomme une par jour.
La réserve est limitée à 24 unités par prédateur, comme capacité de stockage
alimentaire. Les anciennes sauvegardes sans ce champ reçoivent 12 unités par
prédateur à la première étape de simulation. Une réserve épuisée augmente la
mortalité progressivement. La reproduction exige des réserves et des proies.
Il n'y a aucun réensemencement d'une population éteinte, ni ratio proies/prédateurs
à atteindre. Une famine prolongée peut provoquer une extinction.

L'arrondi stochastique déterministe est calculé à partir de la graine, de la date,
des coordonnées et du processus concerné. Il ne nécessite aucune boucle par
individu : le coût dépend du nombre de territoires, même pour un grand troupeau.

## Sous-zones, sauvegardes et mobile

Les sous-zones deviennent une projection persistante des effectifs communs. Leur
animation conserve les populations et fait poursuivre les proies par les
prédateurs ; naissances, chasses, morts et migrations sont appliquées au pas
quotidien du moteur. Les compteurs d'événements dans la vue locale sont explicitement
ceux du monde. La végétation locale conserve ses transformations et ses récoltes.
Le fond et le terrain sous les animaux sont conservés pour qu'un déplacement ne
régénère pas une ressource déjà récoltée.

`syncDetail` rapproche les glyphes des populations quand un territoire est consulté,
sans recalculer toutes les sous-grilles visitées chaque jour. Les cases découvertes,
constructions et modifications du terrain sont préservées. L'ancien champ local
`hunger` et les fausses proies du fond sont remplacés par l'état commun. Les nouvelles
cartes ne placent plus d'animaux dans les rivières/lacs/ruines créés après le premier
peuplement procédural. Les effectifs déjà sauvegardés restent conservés.

Après le retour Samsung Android, la grille représente des **groupes** :
`min(8, ceil(herbivores/5))` glyphes `a` et `min(4, ceil(prédateurs/2))` glyphes `W`.
Ces budgets n'interviennent jamais dans la simulation : 5 000 herbivores restent
5 000 individus même avec huit symboles. Si les cases terrestres libres ne suffisent
pas, moins de groupes sont représentés.

Trois mesures apparaissent : effectifs réels du territoire, glyphes de groupes de
sa grille, glyphes réellement visibles après brouillard et masquage par `@`.
Les compteurs sont actualisés après chaque animation. L'inspection et la légende
expliquent qu'un symbole représente un groupe, sans promettre une taille fixe.
Le fourrage quantitatif est distingué des cases végétales du paysage local.

Les anciennes grilles individuelles sont réduites au nouveau budget même si les
effectifs n'ont pas changé, grâce à une signature versionnée. Les cases découvertes
et le terrain sous les anciens animaux sont conservés. Cette limite concerne
seulement l'affichage. Les passages aux frontières sont désormais des
transferts entre effectifs de territoires ; ils ne dépendent plus de la présence
d'un glyphe sur le bord de la sous-grille du joueur.

La minuterie anime uniquement les sous-zones affichées ; elle ne modifie plus les
effectifs planétaires. Le bouton « 30 jours » utilise le même moteur que les jours
ordinaires, laisse la main à l'interface tous les cinq jours et empêche les ticks
concurrents. Il avance l'écologie et la date, comme outil de simulation ; il ne
simule pas l'économie de la colonie. Une nouvelle partie annule son travail restant.

Le moteur reste sans dépendance, avec complexité O(territoires) et tableaux
numériques temporaires. La qualité climatique n'est calculée qu'une fois par
territoire et par jour. L'animation parcourt une grille fixe de 225 cases.

## Retour Samsung Android : mesures avant/après

La référence « avant » est le commit de PR `920a5cc`, et non `development`.
[metrics/android-review.json](metrics/android-review.json) contient les mesures
complètes et les empreintes SHA-256 des moteurs. Les cartes initiales et les graines
sont identiques. Un an dure 48 jours : les points sont les jours 49, 241 et 481.
La densité moyenne utilise les territoires habitables ; le maximum et les nombres
de territoires occupés sont aussi enregistrés.

| Graine | Pic H avant → après | À 1 an H/P avant → après | À 5 ans H/P avant → après | À 10 ans H/P avant → après |
| --- | --- | --- | --- | --- |
| 1 | 5 379 → 3 626 (−33 %) | 2 352/120 → 1 574/117 | 842/12 → 556/13 | 680/3 → 755/0 |
| 29 | 5 741 → 3 312 (−42 %) | 3 586/99 → 2 240/85 | 1 571/26 → 1 149/28 | 1 549/6 → 1 562/5 |
| 2026 | 6 963 → 4 585 (−34 %) | 4 089/136 → 2 667/128 | 1 278/12 → 898/27 | 1 166/0 → 1 491/4 |

| Graine | Densité maximale H à 1 an avant → après | Biomasse à 1 an avant → après | Migrations H/P cumulées à 10 ans avant → après |
| --- | --- | --- | --- |
| 1 | 9 → 5 | 188 908 → 229 636 | 144 543/5 319 → 94 224/5 194 |
| 29 | 9 → 4 | 134 891 → 168 578 | 266 347/7 102 → 152 690/6 812 |
| 2026 | 10 → 4 | 201 005 → 250 325 | 264 398/6 394 → 140 884/8 119 |

Le pic initial diminue et davantage de fourrage subsiste à un an. La baisse des
migrations herbivores accompagne des effectifs moindres ; elle n'est pas un quota.
Les chasses cumulées passent respectivement de 1 717/2 551/2 260 à
1 451/2 006/2 389. À un an, 76–87 % des prédateurs initiaux subsistent.

La coexistence reste contingente : avant, la graine 2026 perdait ses prédateurs au
jour 412 ; après, c'est la graine 1 au jour 381. Aucune des trois graines ne perd
tous ses herbivores. Les effectifs à dix ans ne sont pas systématiquement plus
faibles : le fourrage préservé et la prédation changent les trajectoires.
Trois graines ne représentent pas tous les mondes possibles.

Les métriques de glyphes du rapport sont des **budgets de représentation** sur tous
les territoires : elles excluent le brouillard et les obstacles des sous-grilles,
qui sont vérifiés dans le navigateur. Exemple : 60 herbivores et 6 prédateurs
occupent 8 + 3 glyphes, au lieu de 66 individus dessinés, sans modifier les effectifs.
Les flux de fourrage historiques non instrumentés sont `null`, et non zéro.

## Validation et reproduction

- `npm run check` : syntaxe et cohérence des deux pages.
- `npm test` : 19 tests, comprenant bilans démographiques et de biomasse,
  reproduction sans surplus, migrations et réserves conservées, poursuite,
  colonisation, famine, extinction, sauvegardes et conversion des anciennes grilles.
- Les scénarios à 1/5/10 ans sont rejoués deux fois sur trois graines en 48 × 24 pour
  le déterminisme, et testés en 144 × 72 contre les pics historiques avec bilans.
- `npm run test:browser` : 21 contrôles par page dans Chromium, viewport 393 × 851,
  contexte mobile/tactile, graine fixée et CPU ralenti ×4. Couverture des compteurs
  réels/groupes/visibles, brouillard et joueur, animation, récoltes, construction,
  sauvegarde, pause et bouton 30 jours avec verrouillage et annulation.
- `npm run benchmark` : JSON des métriques à 1/5/10 ans, migrations et extinctions.
  Une version historique peut être fournie :
  `node scripts/benchmark.cjs /tmp/ecosystem-before.js`.

Sur ce même environnement, les médianes quotidiennes avant → après sont de
4,43 → 4,53 ms ; 3,99 → 3,86 ms ; 4,70 → 4,70 ms. Les p95 après sont de
8,45 / 6,35 / 7,59 ms. Le matériel et le navigateur changent ces durées.
Le bouton 30 jours rend la main aux temporisations, vérifié avec CPU ralenti.
Aucun scan de toutes les sous-grilles n'est ajouté.

Ces mesures Chromium et Node ne remplacent pas une nouvelle campagne sur Samsung
Android pour évaluer fluidité, autonomie et mémoire. Le climat existant peut
assécher durablement des régions ; ses règles et les ressources initiales ne sont
pas modifiées pour maintenir artificiellement une population. Les unités et les
paramètres restent abstraits, sans distinction d'espèce, âge ou gestation.
