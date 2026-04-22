# Product Requests Module

## Rôle du module

Le module `product-requests` permet aux utilisateurs de proposer des produits qui ne sont pas encore présents dans le catalogue.

Il permet de :

- créer une demande de produit
- consulter les demandes
- revoir (approve / reject / under review)
- transformer une demande en produit catalogue
- publier une demande en item de wishlist
- notifier les utilisateurs et admins

Ce module sert de pont entre :

👉 wishlist-items (besoin utilisateur)  
👉 catalog (données validées)

---

## Position dans l’architecture

Le module connecte :

- `wishlists` (où la demande est faite)
- `events` (contexte)
- `users` (demandeur)
- `catalog` (produit final)
- `wishlist-items` (publication finale)
- `notifications` (communication)

Il implémente un **workflow complet produit → validation → publication**.

---

## Structure du module

- `product-requests.module.ts`
- `product-requests.controller.ts`
- `product-requests.service.ts`
- `product-request.entity.ts`
- DTOs :
  - `create-product-request.dto.ts`
  - `review-product-request.dto.ts`
  - `publish-product-request.dto.ts`
- Enum :
  - `product-request-status.enum.ts`

---

## Entité : `ProductRequest`

Table : `product_requests` :contentReference[oaicite:0]{index=0}

### Champs

- `id`
- `event`
- `wishlist`
- `requestedBy`
- `category`
- `approvedCatalogProduct`
- `name`
- `description`
- `imageUrl`
- `referenceUrl`
- `estimatedPrice`
- `currencyCode`
- `status`
- `reviewComment`
- `reviewedAt`
- `createdAt`
- `updatedAt`

---

## Enum : `ProductRequestStatus`

````ts
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
PUBLISHED

DTOs
CreateProductRequestDto
{
  "wishlistId": 1,
  "categoryId": 2,
  "name": "PlayStation 5",
  "description": "Console gaming",
  "imageUrl": "...",
  "referenceUrl": "...",
  "estimatedPrice": 300000,
  "currencyCode": "XOF"
}

ReviewProductRequestDto

Permet de :

changer le statut
assigner une catégorie
lier à un produit catalogue existant
créer un produit catalogue

PublishProductRequestDto
{
  "name": "PS5",
  "price": 300000,
  "quantity": 1
}

Controller : ProductRequestsController

Routes exposées :

POST /product-requests
GET /product-requests
GET /product-requests/:id
GET /product-requests/wishlist/:wishlistId
PATCH /product-requests/:id/review
PATCH /product-requests/:id/publish
Endpoints
POST /product-requests

Crée une demande produit.

Auth

JWT requis

Traitement
vérifie wishlist
vérifie user
vérifie catégorie (optionnelle)
crée demande avec :
status = SUBMITTED
Notification

👉 envoie notification à tous les admins :

type : PRODUCT_REQUEST_SUBMITTED
GET /product-requests

Retourne toutes les demandes.

Filtre optionnel
status
GET /product-requests/wishlist/:wishlistId

Retourne les demandes d’une wishlist.

GET /product-requests/:id

Retourne une demande spécifique.

PATCH /product-requests/:id/review

🔥 Étape clé : modération

Workflow de review
1. REJECTED
met à jour statut
ajoute commentaire
notifie utilisateur
2. UNDER_REVIEW
statut intermédiaire
notifie utilisateur
3. APPROVED / PUBLISHED

Deux cas :

Cas A : produit catalogue existant
approvedCatalogProductId

➡️ lie directement

Cas B : création nouveau produit

Conditions :

category requise
slug requis
slug unique

Création :

CatalogProduct

➡️ status = ACTIVE

Notifications
PRODUCT_REQUEST_APPROVED
PRODUCT_REQUEST_REJECTED
PRODUCT_REQUEST_UNDER_REVIEW
PATCH /product-requests/:id/publish

🔥 Fonction critique

Transforme une demande en item de wishlist.

Workflow de publication
Conditions
status = APPROVED ou PUBLISHED
pas déjà publié
wishlist + event présents
Transaction
manager.transaction(...)
Création item
WishlistItem

avec :

name
price
quantity
targetAmount = price * quantity
fundedAmount = 0
remainingAmount = targetAmount
fundingStatus = NOT_FUNDED
reservationMode = EXCLUSIVE

---

### Mise à jour request

```ts
status = PUBLISHED
Notification
PRODUCT_REQUEST_PUBLISHED
Service : ProductRequestsService

create(dto, userId)
crée demande
notifie admins
findAll(status?)
filtre optionnel
findByWishlist(wishlistId)
review(id, dto)

🔥 logique métier la plus complexe

gestion statuts
liaison catalogue
création produit si nécessaire
notifications
publish(id, dto)

🔥 transformation finale

crée wishlist item
met à jour request
notifie user
Règles métier implémentées
1. Workflow strict

SUBMITTED → UNDER_REVIEW → APPROVED → PUBLISHED

2. Séparation validation / publication
APPROVED ≠ visible
PUBLISHED = visible dans wishlist
3. Intégration catalog
peut utiliser produit existant
ou créer nouveau produit
4. Cohérence transactionnelle

Publication = transaction complète

5. Notifications automatiques
admins
utilisateur
6. Validation forte
catégorie requise pour approval
slug unique
produit existant valide
Points forts

✅ workflow complet
✅ intégration catalog
✅ création automatique wishlist-item
✅ notifications intégrées
✅ logique métier avancée

Limites actuelles
pas de gestion rôles (admin vs user non strict)
pas de pagination
pas de versionning request
pas de modification après soumission
pas de SLA review
Résumé

Le module product-requests permet :

aux utilisateurs de proposer des produits
aux admins de valider ou rejeter
d’intégrer ces produits au catalogue
de publier directement en wishlist item

C’est une brique clé pour :

👉 enrichir le catalogue
👉 améliorer l’expérience utilisateur
👉 scaler le contenu produit

````
