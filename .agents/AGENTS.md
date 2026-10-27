# Directives Projet — BKO COSMO DISTRIBUTION

## Stack Technique
- **Backend** : Node.js (CommonJS), Express 5 (`server/server.js`, `server/database.js`, `server/rules.js`, `server/excel.js`).
- **Frontend** : Vanilla JavaScript, CSS natif, GSAP, Three.js (`public/`).
- **Données** : Fichiers JSON persistants sous `data/` (`products.json`, `orders.json`, `settings.json`).
- **Tests** : `node test-rules.js && node test-api.js`. Sous Windows PowerShell, n’utilise pas npm test si npm.ps1 est bloqué par la politique d’exécution.

## Règles Métier & Données
- **Colisage strict** : Paliers obligatoires de 6 en 6 (6, 12, 18...) ou exception de 3 (3, 6, 12...). Les quantités 9, 15 et 21 sont formellement interdites. Validation obligatoire côté client (`public/js/rules.js`) ET serveur (`server/rules.js`).
- **Prix en FCFA & Gel** : Montants exprimés en FCFA. Les prix unitaires sont scellés à la commande dans `orders.json`. Ne jamais recalculer rétroactivement l'historique des commandes passées.
- **Atomicité JSON** : Les écritures dans `data/*.json` doivent préserver la structure et l'intégrité des données sans corruption concurrente.

## Conventions de Code & Tests
- Exécuter systématiquement `node test-rules.js && node test-api.js` après toute modification de logique métier ou d'API. Sous Windows PowerShell, n’utilise pas npm test si npm.ps1 est bloqué par la politique d’exécution.
- Respecter le format CommonJS pour le backend (`require` / `module.exports`).
- Pas de dépendances CDN externes : les bibliothèques frontend résident sous `public/vendor/`.

## Sécurité
- Ne jamais ajouter de nouveaux secrets, mots de passe ou tokens en clair. Les accès d’administration existants doivent être migrés progressivement vers des variables d’environnement non versionnées. Ne jamais les afficher, copier ou dupliquer dans de nouveaux fichiers.
- Interdiction d'exécuter des commandes destructives (`rm -rf`, `git reset --hard`, `git push --force`).

## Options à la Demande
- **Rendu Vocal** : Uniquement à la demande explicite de l'utilisateur (ex. mentions : *"en vocal"*, *"rendu vocal"*, *"synthèse vocale"*), générer un lecteur interactif de synthèse vocale récapitulant les points clés du travail réalisé.
