🚀 README — Backend (Global)

# 🎁 Event Wishlist & Contribution Platform — Backend

## 🧭 Overview

Ce projet est un backend NestJS permettant de gérer une plateforme de type :

> 🎉 Event-based wishlist & collaborative gifting platform  
> (ex: mariage, anniversaire, baby shower, etc.)

Les utilisateurs peuvent :

- créer des événements
- inviter des participants
- ajouter des items (cadeaux)
- réserver ou financer ces items
- effectuer des paiements
- suivre les contributions
- interagir avec un catalogue produit
- recevoir des notifications

---

## 🏗️ Architecture

Le projet est basé sur une architecture modulaire NestJS.

### 🔧 Stack technique

- **Framework** : NestJS
- **ORM** : TypeORM
- **Database** : PostgreSQL (ou compatible)
- **Auth** : JWT + Passport
- **Validation** : class-validator
- **Hashing** : bcrypt
- **File upload** : multer (local storage)
- **Langage** : TypeScript

---

## 🧩 Modules principaux

### 🔐 Auth & Users

- `auth`
- `users`

👉 Gestion des comptes, JWT, rôles plateforme et sécurité.

---

### 🎉 Core Event System

- `events`
- `participants`
- `dashboard`

👉 Gestion des événements, rôles contextuels et analytics.

---

### 🎁 Wishlist System

- `wishlists`
- `wishlist-items`
- `reservations`

👉 Gestion des cadeaux, réservation et disponibilité.

---

### 💰 Financial System

- `contributions`
- `payments`

👉 Contribution financière + paiement + cohérence financement.

---

### 🛍️ Product System

- `catalog`
- `product-requests`

👉 Catalogue produit + workflow de validation + publication en wishlist.

---

### 🔔 Communication

- `notifications`

👉 Notifications système (in-app, extensible push/email).

---

## 🔑 Concepts clés

### 1. Rôles multi-niveaux

#### Rôle plateforme

- `USER`
- `ADMIN`
- `SUPER_ADMIN`

#### Rôle événementiel

- `ORGANIZER`
- `CO_ORGANIZER`
- `GUEST`

---

### 2. Event-centric architecture

Tout tourne autour de l’événement :

Event
├── Participants
├── Wishlist
│ └── WishlistItems
│ ├── Reservations
│ └── Contributions
│ └── Payments

---

### 3. Workflow complet produit

Product Request
↓
Review (Admin)
↓
Catalog Product (optionnel)
↓
Publish
↓
Wishlist Item

---

### 4. Flow financier

Wishlist Item
↓
Contribution (AWAITING_PAYMENT)
↓
Payment
↓
CONFIRMED
↓
Recalculate Item Funding

---

## 🔐 Sécurité

### Authentification

- JWT (Bearer token)
- expiration : 7 jours

### Guards

- `JwtAuthGuard`
- `RolesGuard`
- `EventRoleGuard`

### Points clés

- contrôle d’accès global (platformRole)
- contrôle d’accès contextuel (event role)
- ownership strict
- validation des données
- transactions SQL critiques

---

## 📡 API Design

### Format standard des réponses

#### Succès

```json
{
  "success": true,
  "message": "Optional message",
  "data": {}
}
Erreur
{
  "success": false,
  "message": "Error message",
  "statusCode": 400
}
🔄 Flows principaux
🎉 Création d’un événement
POST /events
création event
création participant (ORGANIZER)
création wishlist
🎁 Ajout d’un item
POST /wishlist-items
validation rôle (organizer)
création item
🔒 Réservation
POST /reservations
vérification disponibilité
mise à jour isReserved
💰 Contribution + paiement
POST /contributions/checkout
création contribution
création paiement
webhook ou success
confirmation contribution
recalcul financement
🛍️ Demande produit
POST /product-requests
review admin
(option) création catalog product
publication
création wishlist item
📊 Dashboard
User dashboard
événements
contributions
paiements
activités récentes
Admin dashboard
stats globales
revenus
activité plateforme
⚙️ Installation
npm install
npm run start:dev
🔑 Variables d’environnement
JWT_SECRET=your_secret_key
NODE_ENV=development
🚀 Évolutions possibles
🔐 Sécurité
refresh token
MFA
email verification
💰 Paiement
Stripe / Flutterwave integration
webhook async queue
refunds
📊 Performance
pagination globale
cache Redis
query optimization
📱 UX
push notifications
preferences utilisateur
notifications temps réel
🛍️ Produit
catalogue enrichi
recommandations
multi-images
🧠 Philosophie du projet

Ce backend est conçu pour :

être modulaire
être scalable
isoler les responsabilités métier
gérer les conflits utilisateurs
garantir la cohérence des données
📌 Résumé

Ce projet implémente une plateforme complète de :

🎁 gestion de wishlist événementielle avec contributions financières

Il couvre :

gestion utilisateurs
gestion événements
gestion wishlist
système de réservation
système de contribution
système de paiement
catalogue produit
workflow produit
notifications
analytics
👨‍💻 Auteur

Backend conçu avec une architecture modulaire NestJS, orientée produit réel et évolutif.
```
