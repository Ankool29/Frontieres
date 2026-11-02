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
Le fourrage consommé dépend du nombre d'herbivores. Leur fertilité diminue lorsque
la nourriture restante par individu baisse ; leur mortalité augmente si les
besoins ne sont pas satisfaits. Aucun plafond de population n'est imposé.

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

Il peut y avoir moins de glyphes que d'individus si les cases terrestres libres
ne suffisent pas ; les compteurs affichent les effectifs réels. Cette limite
concerne seulement l'affichage. Les passages aux frontières sont désormais des
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

## Validation

- `npm run check` : syntaxe du moteur et des scripts intégrés, cohérence des deux pages.
- `npm test` : migrations, conservation des réserves et des individus, absence de
  double déplacement, densité, climat, poursuite, colonisation, frontières,
  barrières, famine, extinction, bilan démographique, déterminisme, sauvegardes,
  projection locale et trois planètes sur dix années de 48 jours.
- `npm run test:browser` : Chromium, viewport 393 × 851, contexte mobile/tactile,
  16 vérifications par page : démarrage, exploration, animation, 30 jours,
  compteurs, tick quotidien, récolte, pause, construction, sauvegarde, verrouillage
  des ticks et annulation de la simulation longue.
- `npm run benchmark` : trois graines, carte réelle, 480 jours calculés par graine.

Observations avec les graines 1, 29 et 2026 (effectifs herbivores / prédateurs) :

| Graine | Jour 1 | Jour 97 (2 ans) | Jour 481 (10 ans) |
| --- | --- | --- | --- |
| 1 | 3 258 / 138 | 733 / 71 | 680 / 3 |
| 29 | 2 750 / 112 | 1 885 / 102 | 1 549 / 6 |
| 2026 | 3 856 / 148 | 1 401 / 109 | 1 166 / 0 |

Sur l'environnement de développement, le calcul quotidien prend environ 4–5 ms
en médiane (p95 observé : 8–14 ms). Ce ne sont pas des mesures sur Android réel.
Le test de durée vérifie la régulation et la survie initiale dans ces scénarios,
pas la coexistence éternelle. Ces trois graines ne couvrent pas tous les mondes.
Le climat existant peut assécher durablement des régions ; ses règles n'ont pas été
modifiées pour maintenir artificiellement les populations. Une campagne sur un
appareil Android reste nécessaire pour mesurer fluidité, autonomie et mémoire.
