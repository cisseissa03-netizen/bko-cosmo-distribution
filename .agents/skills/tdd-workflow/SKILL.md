---
name: tdd-workflow
description: >-
  Guide pas-à-pas pour implémenter de nouvelles fonctionnalités ou corriger des anomalies
  en appliquant un cycle TDD strict (Red-Green-Refactor) adapté à la suite de tests Node.js du projet.
---

# TDD Workflow — BKO Cosmo Distribution

Suivez rigoureusement ce processus pour toute modification de la logique de colisage, de calcul de prix ou des endpoints API.

## 1. Détection et état des lieux des tests
- Lancez la suite de validation pour vérifier l'état initial :
  `npm test`
- Vérifiez que les tests existants (`test-rules.js` et `test-api.js`) passent à 100%.

## 2. Phase Rouge (Red)
1. Localisez ou créez l'assertion ciblée :
   - Pour les règles de colisage / calculs : éditez `test-rules.js`.
   - Pour les routes REST ou le stockage JSON : éditez `test-api.js`.
2. Ajoutez un test unitaire ou d'intégration décrivant le comportement attendu.
3. Exécutez `npm test` et confirmez l'échec ciblé (échec attendu avant implémentation).

## 3. Phase Verte (Green)
1. Implémentez le code minimal :
   - Côté serveur : `server/rules.js`, `server/database.js` ou `server/server.js`.
   - Côté client si applicable : `public/js/rules.js` ou `public/js/app.js`.
2. Relancez `npm test` jusqu'à validation complète de la nouvelle assertion.

## 4. Phase de Refactorisation (Refactor)
1. Nettoyez le code, éliminez la duplication et assurez la cohérence CommonJS.
2. Assurez-vous que la persistance dans `data/*.json` reste intègre.
3. Exécutez une dernière fois `npm test` pour confirmer l'absence de régression.
