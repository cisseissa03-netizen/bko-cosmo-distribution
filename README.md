# BKO COSMO DISTRIBUTION — Plateforme Grossiste Pharmacies & Supermarchés (Bamako)

Plateforme web professionnelle de catalogue et de demandes de commande conçue pour la distribution en gros de dermo-cosmétique, soins bébé et hygiène à **Bamako, Mali**.

Le propriétaire de la plateforme est lui-même **Directeur Commercial & CEO**, assurant la gestion du catalogue, la vérification des demandes et la coordination logistique.

---

## 🚀 Démarrage Rapide

### 1. Lancement du serveur
```bash
npm start
```
*Le serveur démarre sur le port `3005` :* **`http://localhost:3005`**

### 2. Accès aux interfaces
- **Espace Client (Pharmacies & Supermarchés) :** [http://localhost:3005](http://localhost:3005)
  - Consultation catalogue, recherche, filtres par marque et catégorie.
  - Commande rapide multi-produits.
  - Nouveaux arrivages avec bouton de partage WhatsApp.
  - Panier de demande avec validation stricte des colisages.
  - Transmission sans compte obligatoire (Quartiers de Bamako, contacts, indications).
  - Suivi en direct du statut de la demande.
- **Espace Administrateur / Gérant & CEO :** [http://localhost:3005/admin.html](http://localhost:3005/admin.html)
  - Mot de passe d'accès : **`0000`** (ou `bamako2026`)
  - **Photos produits :** Import direct depuis smartphone/PC, prévisualisation immédiate et sélection de modèles pro.
  - **Import / Export Excel :** Téléchargement du modèle Excel pré-formaté, importation par glisser-déposer de listes complètes de produits avec prévisualisation des lignes, et exportation du catalogue existant.
  - Gestion du catalogue, stocks, prix en FCFA.
  - Activation de l'autorisation à 3 unités permanente (produit technique) ou ponctuelle (stock limité).
  - Suivi des demandes reçues, modification des statuts (`Demande reçue` → `Confirmée` → `Livrée`).
  - Statut de paiement indépendant (`Non payé`, `Payé à la livraison`, etc.).
  - Édition et impression du **Devis Proforma** et du **Bon de Livraison (BL)**.

### 3. Exécution des tests automatisés
```bash
npm test
```
*Vérifie 19 assertions sur les règles de colisage ainsi que l'API de validation et de sécurité.*

---

## 📋 Règles Commerciales Validées

### 1. Prix et Devises
- Montants affichés en **Francs CFA (FCFA)**.
- Affichage distinct : Prix unitaire, Quantité sélectionnée, Total de la ligne, Total estimatif global.
- **Gel des prix à la commande :** Au moment de la validation, le prix unitaire du catalogue est scellé dans la demande. Modifier ultérieurement le prix d'un produit ne change pas l'historique des commandes passées.

### 2. Règle de Colisage par Référence (Contrôle Strict et Indépendant)
Chaque référence est évaluée séparément (aucune compensation entre articles).
- **Règle Standard :**
  - Minimum : **6 unités**
  - Paliers : **6, 12, 18, 24, 30...**
  - Interdits : 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15... (3 et 9 sont strictement rejetés).
- **Exception 3 Unités :**
  - Activée pour les produits techniques ou accordée ponctuellement par le CEO en cas de stock limité.
  - Paliers : **3, 6, 12, 18, 24, 30...**
  - Interdits : Les quantités 9, 15 et 21 restent formellement interdites.
- **Validation bilatérale :** La règle est contrôlée dans l'interface et ré-exécutée côté serveur (`POST /api/orders`). Toute manipulation manuelle de requête est interceptée avec une erreur HTTP 400 explicite.

---

## 🎨 Direction Artistique & Animations (GSAP & Three.js)

### GSAP (Micro-interactions discrètes)
- Apparition échelonnée de l'accueil (Hero, badges, CTAs).
- Entrée progressive des cartes produits lors du filtrage.
- Slide-over fluide du panier de commande.
- Effet tactile de confirmation lors de l'ajout au panier.
- Conforme à `prefers-reduced-motion` : aucune animation intrusive, aucun détournement du défilement.

### Three.js (Composition 3D Décorative & Légère)
- Scène 3D procédurale évoquant les flacons et soins cosmétiques avec éclairage doux champagne & émeraude.
- **Progressive Enhancement :**
  - Aucun modèle 3D lourd n'est imposé sur mobile.
  - Pause automatique hors écran via `IntersectionObserver` pour préserver la batterie.
  - Bouton de pause manuelle utilisateur.
  - Remplacement automatique par un visuel statique si WebGL est désactivé ou si l'utilisateur préfère la réduction de mouvement.
  - **Exclue** des pages administratives et de la transmission pour garantir une rapidité absolue.

---

## 📂 Architecture du Projet

```
produits cosmetic/
├── data/                      # Base de données persistante JSON
│   ├── products.json          # Références cosmétiques & stock
│   ├── orders.json            # Demandes clients enregistrées
│   └── settings.json          # Paramètres entreprise & WhatsApp Bamako
├── public/                    # Assets web servis directement
│   ├── css/
│   │   └── style.css          # Feuille de style responsive & design sobre
│   ├── js/
│   │   ├── app.js             # Application client & gestion des paniers
│   │   ├── admin.js           # Espace gérant / CEO & traitement des demandes
│   │   ├── rules.js           # Règles commerciales partagées (navigateur)
│   │   ├── gsap-animations.js # Micro-animations discrètes GSAP
│   │   └── three-hero.js      # Scène 3D décorative Three.js
│   ├── vendor/                # Bibliothèques locales (aucune dépendance CDN externe)
│   │   ├── gsap.min.js        # GSAP local
│   │   └── three.module.js    # Three.js local
│   ├── index.html             # Interface publique principale
│   ├── admin.html             # Interface d'administration CEO
│   ├── print-proforma.html    # Impression Devis Proforma
│   └── print-delivery.html    # Impression Bon de Livraison (BL)
├── server/
│   ├── database.js            # Couche d'accès aux données persistantes
│   ├── rules.js               # Validation serveur des colisages & calculs
│   └── server.js              # API REST Express & sécurité
├── test-rules.js              # Tests unitaires des règles de colisage (19 tests)
├── test-api.js                # Tests d'intégration API & sécurité des données
├── package.json
└── README.md
```

---

## 🛡️ Ce qui fonctionne réellement vs Configurations nécessaires

| Fonctionnalité | Statut | Note |
|---|---|---|
| Catalogue & Filtres | ✅ Opérationnel | 10 références réelles pré-configurées pour Bamako |
| Règle de colisage (6, 12... / 3, 6, 12...) | ✅ Opérationnel | Validé côté client et côté serveur |
| Panier & Persistance | ✅ Opérationnel | Mémorisé dans `localStorage` lors de la navigation |
| Transmission de demande | ✅ Opérationnel | Enregistrement immédiat dans la base `data/orders.json` |
| WhatsApp pré-rempli | ✅ Opérationnel | Ouvre WhatsApp avec récapitulatif complet prêt à l'envoi |
| Espace Gérant / CEO | ✅ Opérationnel | Authentifié, KPIs, modification statuts & notes internes |
| Devis Proforma & Bon de Livraison | ✅ Opérationnel | Modèles d'impression A4 conformes |
| Numéro WhatsApp réel du CEO | ⚙️ Configuration | Remplacer `+22370000000` dans `data/settings.json` par votre numéro réel |
