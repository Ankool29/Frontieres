# FRONTIÈRES — Les mondes oubliés

Jeu de gestion et d'exploration sur une planète inconnue.

Le développement se fait sur la branche `development` afin de préserver la branche principale.

## Lancer le prototype

Ouvrir `index.html` dans un navigateur récent. Le jeu est conçu pour les écrans mobiles et fonctionne sans dépendance externe.

## Feuille de route

- [x] Prototype jouable : exploration, collecte, constructions et cycle jour/nuit.
- [ ] Version 0.2 : habitants autonomes, besoins, métiers et interactions entre systèmes.
- [ ] Sauvegarde et équilibrage approfondis.

## Simulation écologique

Les effectifs par territoire sont la référence pour les migrations, la reproduction,
la prédation et les sous-zones explorées. Voir [l'architecture et les règles](docs/ecology.md).

## Vérifications de développement

Node.js 22.15 ou plus récent, sans paquet npm à installer :

```sh
npm run check
npm test
npm run benchmark
```

Test des deux pages dans un navigateur avec viewport mobile et interactions tactiles :

```sh
python -m pip install playwright
# Installer Chromium avec le gestionnaire de paquets du système,
# ou définir CHROMIUM_BIN avec le chemin d'un navigateur Chromium existant.
npm run test:browser
```

Le navigateur sert une copie temporaire du jeu sur une adresse locale et utilise des
sauvegardes isolées. Ces dépendances servent uniquement aux tests ; le jeu reste
utilisable sans installation ni dépendance externe.
