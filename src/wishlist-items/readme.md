Voici la version prête à copier-coller :

# Wishlist Items Module

## Rôle du module

Le module `wishlist-items` gère les éléments concrets d’une wishlist d’événement.

Il permet de :

- créer un item dans une wishlist
- lister les items
- exposer la wishlist d’un événement avec filtres et tris
- retourner le détail enrichi d’un item
- supprimer un item sous conditions métier

C’est le module qui porte la logique métier opérationnelle autour des cadeaux / éléments finançables visibles dans une wishlist.

---

## Position du module dans l’architecture

Dans l’architecture actuelle :

- `wishlists` représente le conteneur
- `wishlist-items` représente le contenu réel affiché et manipulé

Chaque `WishlistItem` est lié :

- à une wishlist
- à un événement
- potentiellement à des réservations
- potentiellement à des contributions

Ce module est utilisé directement par :

- `events` pour exposer la wishlist publique d’un événement
- `events` pour construire `my-view`
- les flux de réservation
- les flux de contribution
- le dashboard événement

---

## Structure du module

Fichiers présents :

- `wishlist-items.module.ts`
- `wishlist-items.controller.ts`
- `wishlist-items.service.ts`
- `wishlist-item.entity.ts`
- `dto/create-wishlist-item.dto.ts`
- `enums/funding-status.enum.ts`
- `enums/reservation-mode.enum.ts`

---

## Entité : `WishlistItem`

Table : `wishlist_items`

### Champs actuellement implémentés

- `id`
- `name`
- `price`
- `quantity`
- `imageUrl`
- `isReserved`
- `reservationMode`
- `targetAmount`
- `fundedAmount`
- `remainingAmount`
- `fundingStatus`
- `eventId`

### Relations

- `event`
- `wishlist`
- `reservations`
- `contributions`

### Lecture métier des champs

#### `price`

Prix unitaire de référence.

#### `quantity`

Quantité souhaitée.

#### `targetAmount`

Montant total visé, calculé comme :

```ts
price * quantity
fundedAmount

Montant déjà confirmé.

remainingAmount

Montant restant à financer.

isReserved

Indique si l’item est actuellement réservé.

reservationMode

Définit la logique de réservation de l’item.

fundingStatus

État de financement de l’item.

Enum : FundingStatus

Valeurs disponibles :

NOT_FUNDED
PARTIALLY_FUNDED
FUNDED

Ce champ permet de suivre l’état global de financement de l’item.

Enum : ReservationMode

Valeurs disponibles :

NONE
EXCLUSIVE
COLLABORATIVE

Dans l’implémentation actuelle, un item créé reçoit par défaut :

ReservationMode.EXCLUSIVE
DTO : CreateWishlistItemDto

Le DTO de création valide les champs suivants :

name : obligatoire, string, max 150
wishlistId : obligatoire, integer >= 1
price : optionnel, number >= 0, max 2 décimales
quantity : optionnel, integer >= 1
imageUrl : optionnel, string, max 1000
Exemple
{
  "name": "TV Samsung",
  "wishlistId": 1,
  "price": 250000,
  "quantity": 1,
  "imageUrl": "https://example.com/tv.jpg"
}
Controller : WishlistItemsController

Routes exposées :

GET /wishlist-items
POST /wishlist-items
GET /wishlist-items/:id
DELETE /wishlist-items/:id

Toutes les réponses utilisent buildSuccessResponse(...).

GET /wishlist-items

Retourne tous les items.

Comportement

Le contrôleur délègue à :

wishlistItemsService.getAllWishlistItems()
Réponse
{
  "success": true,
  "message": "Wishlist items récupérés",
  "data": {
    "items": [],
    "total": 0
  }
}
Remarque

Cette route n’est pas protégée dans l’implémentation actuelle.

POST /wishlist-items

Crée un item dans une wishlist.

Auth

JWT requis.

Guards
JwtAuthGuard
EventRoleGuard
Rôles autorisés
ORGANIZER
CO_ORGANIZER
Body attendu
{
  "name": "TV Samsung",
  "wishlistId": 1,
  "price": 250000,
  "quantity": 1,
  "imageUrl": "https://example.com/tv.jpg"
}
Traitement métier

Le service :

vérifie que la wishlist existe
charge l’événement lié à la wishlist
normalise le nom
vérifie qu’aucun item du même nom n’existe déjà dans cette wishlist
initialise les montants :
quantity = 1 par défaut
price = 0 par défaut
targetAmount = price * quantity
fundedAmount = 0
remainingAmount = targetAmount
initialise les statuts :
fundingStatus = NOT_FUNDED
reservationMode = EXCLUSIVE
sauvegarde l’item
Règle importante

La déduplication est faite par :

trim
lowercase
comparaison du nom dans la même wishlist

Donc deux items avec le même nom logique ne peuvent pas coexister dans une même wishlist.

Réponse
{
  "success": true,
  "message": "Item créé avec succès",
  "data": {
    "item": {}
  }
}
GET /wishlist-items/:id

Retourne le détail enrichi d’un item.

Auth

Aucune authentification requise dans l’état actuel.

Données retournées

La réponse contient :

item
stats
contributions
Bloc item

Il contient :

id
eventId
eventTitle
wishlistId
name
price
quantity
imageUrl
isReserved
reservationMode
targetAmount
fundedAmount
remainingAmount
fundingStatus
progressPercent
Bloc stats

Il contient :

confirmedContributionsCount
contributorsCount
Bloc contributions

Il contient uniquement les contributions :

CONFIRMED
triées par confirmedAt DESC

Les contributeurs anonymes sont respectés :

si isAnonymous = true, contributor = null
Calcul de progression
progressPercent = (fundedAmount / targetAmount) * 100

si targetAmount > 0, sinon 0.

DELETE /wishlist-items/:id

Supprime un item.

Auth

JWT requis.

Guards
JwtAuthGuard
EventRoleGuard
Rôles autorisés
ORGANIZER
CO_ORGANIZER
Règles métier de suppression

La suppression est refusée si :

l’item est réservé activement
une contribution est en cours (AWAITING_PAYMENT)
un paiement validé (SUCCEEDED) existe déjà
Messages d’erreur possibles
Impossible de supprimer : l'item est réservé
Impossible de supprimer : contribution en cours
Impossible de supprimer : paiement déjà validé
Remarque importante

La suppression ne bloque pas explicitement sur une contribution CONFIRMED seule, mais elle bloque bien si un paiement SUCCEEDED existe sur les contributions de l’item.

Service : WishlistItemsService

Le service contient la logique métier principale du module.

getAllWishlistItems()

Retourne tous les items.

createWishlistItem(name, wishlistId, price?, quantity?, imageUrl?)

Crée un item.

Vérifications
wishlist existante
unicité du nom dans la wishlist
Initialisation métier
quantity = 1 si absent
price = 0 si absent
targetAmount = price * quantity
fundedAmount = 0
remainingAmount = targetAmount
fundingStatus = NOT_FUNDED
reservationMode = EXCLUSIVE
Détail important

L’item stocke aussi eventId, récupéré depuis la wishlist liée :

eventId: wishlist.event.id

Cela permet de requêter plus facilement les items par événement.

getEventWishlist(eventId, filter = 'all', sort = 'created_desc')

Retourne la wishlist d’un événement avec enrichissement.

Types supportés
Filtres disponibles
all
available
reserved
funded
Tris disponibles
created_desc
created_asc
progress_desc
remaining_asc
name_asc
Données calculées

Pour chaque item, la méthode retourne :

id
name
price
quantity
imageUrl
isReserved
reservationMode
targetAmount
fundedAmount
remainingAmount
fundingStatus
progressPercent
confirmedContributionsCount
contributorsCount
Source des stats

Les contributions prises en compte ici sont uniquement celles avec statut :

ContributionStatus.CONFIRMED
Règle de progression

Le pourcentage est calculé directement côté requête SQL.

getWishlistItemDetails(id)

Retourne le détail enrichi d’un item.

Ce que fait la méthode
charge l’item avec wishlist et wishlist.event
charge les contributions confirmées
respecte l’anonymat
calcule la progression
calcule le nombre de contributeurs uniques
applyFilter(qb, filter)

Méthode privée de filtrage.

available

Conserve les items :

non réservés
non totalement financés
reserved

Conserve les items :

réservés
funded

Conserve les items :

totalement financés
all

Aucun filtre supplémentaire

applySort(qb, sort)

Méthode privée de tri.

created_desc

Tri par id DESC

created_asc

Tri par id ASC

progress_desc

Tri par progression décroissante

remaining_asc

Tri par montant restant croissant

name_asc

Tri alphabétique sur le nom

deleteWishlistItem(id)

Supprime un item si les règles métier le permettent.

Vérifie :
existence de l’item
absence de réservation active
absence de contribution en attente
absence de paiement réussi
Chargement nécessaire

La méthode charge :

reservations
contributions
contributions.payments

Cela permet de sécuriser la suppression avec une vraie vision métier de l’état de l’item.

Module : WishlistItemsModule
Entités enregistrées
WishlistItem
Wishlist
Contribution
EventParticipant
Event
Imports
AuthModule
Provider
WishlistItemsService
Export
WishlistItemsService
Remarque

Le module exporte son service, ce qui confirme qu’il est réutilisé par d’autres modules comme events.

Règles métier effectivement implémentées
1. Unicité du nom dans une wishlist

Deux items avec le même nom logique ne peuvent pas être créés dans une même wishlist.

2. Calcul automatique des montants

À la création :

targetAmount = price * quantity
fundedAmount = 0
remainingAmount = targetAmount
3. État initial standardisé

Tout item créé démarre avec :

fundingStatus = NOT_FUNDED
reservationMode = EXCLUSIVE
4. Statistiques basées sur les contributions confirmées

Les agrégations publiques utilisent uniquement les contributions confirmées.

5. Détails enrichis avec anonymat respecté

Les contributions anonymes n’exposent pas le contributeur.

6. Suppression sécurisée

Un item ne peut pas être supprimé s’il est déjà engagé dans un flux métier critique :

réservation active
contribution en attente
paiement validé
Limites actuelles

Le module ne gère pas encore explicitement :

mise à jour d’un item
changement manuel du mode de réservation
changement manuel du funding status
gestion de catégories d’items
publication / archivage
multi-image
source produit catalogue vs demande produit
validation d’accès plus fine sur la création à partir de l’event courant dans le body
Point d’attention important

La route POST /wishlist-items repose sur wishlistId, mais ne reçoit pas directement eventId dans le DTO.
Le service déduit eventId à partir de la wishlist :

relations: ['event']

puis :

eventId: wishlist.event.id

C’est un bon point architectural, car cela évite une incohérence entre wishlistId et eventId dans la création.

Résumé

Le module wishlist-items est un vrai module métier.

Il gère actuellement :

la création d’items
la déduplication par nom
le calcul initial des montants
la liste filtrée et triée des items d’un événement
le détail enrichi d’un item
la suppression sécurisée sous contraintes métier

C’est l’un des modules clés pour la partie cœur produit de la wishlist événementielle.
```
