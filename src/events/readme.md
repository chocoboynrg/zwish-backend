Voici la version prête à copier-coller :

# Events Module

## Rôle du module

Le module `events` gère les événements de la plateforme et centralise leur vue métier principale.

Il permet de :

- créer un événement
- lister les événements
- générer un lien d’invitation
- retourner un aperçu public via `shareToken`
- retourner une vue enrichie de l’événement pour un utilisateur connecté
- retourner un dashboard sécurisé pour les organisateurs
- supprimer un événement sous conditions

Ce module orchestre aussi plusieurs dépendances métier liées à un événement :

- participants
- wishlist
- wishlist items
- contributions
- réservations
- paiements

---

## Structure du module

Fichiers présents :

- `events.module.ts`
- `events.controller.ts`
- `events.service.ts`
- `event.entity.ts`
- `event-dashboard.service.ts`
- `dto/create-event.dto.ts`

---

## Entité : `Event`

Table : `events`

### Champs actuellement implémentés

- `id`
- `title`
- `eventDate`
- `description`
- `shareToken`

### Relations

- `organizer` : utilisateur propriétaire technique de l’événement
- `reservations`
- `contributions`
- `participants`

### Code métier important

```ts
@ManyToOne(() => User, { eager: true, nullable: false })
organizer: User;

Le champ organizer désigne l’owner technique de l’événement.

Remarque importante

L’entité actuelle est volontairement simple.
Les champs suivants, souvent prévus dans une version plus complète, ne sont pas présents pour le moment :

status
visibility
slug
cover image
currencyCode
city
countryCode
allowContributions
allowAnonymousContributions
DTO : CreateEventDto

Le DTO de création est minimal et strictement validé.

Champs validés
title : obligatoire, string, max 150
eventDate : obligatoire, date ISO
description : optionnel, string, max 500
Exemple
{
  "title": "Anniversaire Mariam",
  "eventDate": "2026-06-20",
  "description": "Fête en famille"
}
Controller : EventsController

Le contrôleur expose les routes suivantes :

GET /events
POST /events
GET /events/:id/dashboard
GET /events/:id/invite-link
GET /events/:id/wishlist
GET /events/share/:shareToken/preview
GET /events/:id/my-view
DELETE /events/:id

Toutes les réponses utilisent buildSuccessResponse(...).

GET /events

Retourne tous les événements.

Comportement
charge les événements avec la relation organizer
trie par id DESC
Réponse
{
  "success": true,
  "message": "Événements récupérés avec succès",
  "data": {
    "items": [],
    "total": 0
  }
}
POST /events

Crée un événement.

Auth

JWT requis.

Body
{
  "title": "Anniversaire Mariam",
  "eventDate": "2026-06-20",
  "description": "Fête en famille"
}
Traitement métier

Lors de la création :

l’utilisateur est vérifié
un shareToken unique est généré
l’événement est créé
un participant est automatiquement créé avec :
rôle ORGANIZER
statut ACCEPTED
joinedAt = now
une wishlist est automatiquement créée avec :
title = Wishlist - {titre événement}
description = description de l’événement
Réponse

La route retourne :

eventId
shareToken
wishlistId
GET /events/:id/dashboard

Retourne le dashboard d’un événement.

Auth

JWT requis.

Guards
JwtAuthGuard
EventRoleGuard
Rôles autorisés
ORGANIZER
CO_ORGANIZER
Source

Le contrôleur délègue à :

eventDashboardService.getEventDashboardSecured(id, user.userId)
Contenu retourné

Le dashboard contient :

event
wishlist
summary
latestContributions
latestPayments

C’est la vue analytique principale destinée à l’organisateur.

GET /events/:id/invite-link

Retourne ou génère le lien d’invitation d’un événement.

Auth

JWT requis.

Guards
JwtAuthGuard
EventRoleGuard
Rôles autorisés
ORGANIZER
CO_ORGANIZER
Résultat

Retourne :

eventId
shareToken
invitePath

Exemple :

{
  "eventId": 1,
  "shareToken": "abc123",
  "invitePath": "/join/abc123"
}
GET /events/:id/wishlist

Retourne les items de la wishlist d’un événement.

Auth

Pas de guard dans l’implémentation actuelle.

Query params
filter
sort
Valeurs par défaut
filter = all
sort = created_desc
Délégation

Cette route appelle :

wishlistItemsService.getEventWishlist(id, filter ?? 'all', sort ?? 'created_desc')
Remarque

Le module events s’appuie ici sur wishlist-items pour exposer la wishlist réelle de l’événement.

GET /events/share/:shareToken/preview

Retourne un aperçu public d’un événement à partir du token.

Auth

Aucune authentification requise.

Données retournées
id
title
eventDate
description
organizer :
id
name
email
Utilité

Cette route permet d’afficher un aperçu avant de rejoindre l’événement.

GET /events/:id/my-view

Retourne la vue enrichie d’un événement pour l’utilisateur connecté.

Auth

JWT requis.

Guards
JwtAuthGuard
EventRoleGuard
Rôles autorisés
ORGANIZER
CO_ORGANIZER
GUEST
Utilité

Cette route est une vue consolidée très utile pour le frontend mobile.

Elle retourne :

event
accessRole
summary
wishlist
Bloc event dans my-view

Le bloc event contient :

id
title
description
eventDate
organizer
wishlistId
canDelete
deleteBlockedReason
Règle métier

canDelete passe à false si :

une contribution CONFIRMED existe
ou un paiement SUCCEEDED existe
Bloc summary dans my-view

Le résumé contient :

participantsCount
totalItems
totalTargetAmount
totalFundedAmount
totalRemainingAmount
Bloc wishlist dans my-view

Chaque item contient :

id
name
imageUrl
quantity
targetAmount
fundedAmount
remainingAmount
fundingStatus
reservationMode
isReserved
reservedByUserId
reservedByMe
reservedByName
canReserve
canContribute
hasPendingContribution
pendingContributionByMe
pendingPaymentId
Logique métier calculée

Pour chaque item, le backend calcule :

s’il existe une réservation active
si l’item est réservé par l’utilisateur courant
s’il existe une contribution en attente
s’il existe une contribution confirmée
si l’utilisateur peut réserver
si l’utilisateur peut contribuer
Règles appliquées

canReserve = true seulement si :

item non réservé
aucune contribution confirmée
aucune contribution en attente

canContribute = true seulement si :

remainingAmount > 0
l’item n’est pas réservé ou il est réservé par moi
aucune contribution en attente
DELETE /events/:id

Supprime un événement.

Auth

JWT requis.

Guards
JwtAuthGuard
EventRoleGuard
Rôle autorisé
ORGANIZER
Règles métier

La suppression est refusée si :

l’utilisateur n’est pas l’organisateur principal
un paiement SUCCEEDED existe déjà sur l’événement
Remarque

Dans getMyEventView, la suppression est aussi affichée comme bloquée si des contributions confirmées existent.
Mais dans deleteEvent, le blocage effectif en base repose actuellement sur la présence d’un paiement réussi.

Service : EventsService

Le EventsService contient la logique métier principale.

Méthodes principales
getAllEvents()

Retourne tous les événements avec leur organisateur.

generateUniqueShareToken()

Méthode privée.

Fonction
génère un token aléatoire hexadécimal
vérifie son unicité
tente jusqu’à 10 fois
Exception possible
throw new Error('Impossible de générer un shareToken unique');
createEvent(title, eventDate, userId, description?)

Crée un événement avec toutes les dépendances nécessaires.

Étapes
récupérer l’utilisateur
générer un shareToken
créer l’événement
créer le participant organisateur
créer la wishlist liée
Retour
{
  eventId,
  shareToken,
  wishlistId
}
getInviteLink(eventId, userId)

Retourne le lien d’invitation.

Vérifications
événement existe
utilisateur autorisé à gérer l’événement
Particularité

Si le shareToken n’existe pas, il est généré puis sauvegardé.

getEventPreviewByShareToken(shareToken)

Retourne un aperçu léger de l’événement.

getMyEventView(eventId, userId)

Construit la vue consolidée utilisateur de l’événement.

Ce que fait la méthode
vérifie l’accès utilisateur
calcule le rôle d’accès
charge la wishlist
charge les items
charge les contributions par item
charge les paiements en attente
charge les réservations actives
calcule les totaux globaux
calcule les permissions métier par item
calcule la possibilité de suppression

C’est une méthode très importante pour l’expérience frontend.

canManageEvent(userId, eventId)

Méthode privée.

Retourne true si le participant est :

ACCEPTED
ORGANIZER ou CO_ORGANIZER
deleteEvent(eventId, userId)

Supprime un événement si les règles métier le permettent.

Vérifications
événement existe
utilisateur est ORGANIZER
aucun paiement SUCCEEDED n’existe
Service : EventDashboardService

Le EventDashboardService est responsable des agrégations et statistiques.

getEventDashboard(eventId)

Construit le dashboard complet.

Contenu calculé
Informations événement
id
title
eventDate
description
organizer
Informations wishlist
id
title
description
Summary
participantsCount
totalItems
reservedItems
fundedItems
partiallyFundedItems
notFundedItems
totalTargetAmount
totalFundedAmount
totalRemainingAmount
fundingProgressPercent
totalContributions
confirmedContributions
awaitingPaymentContributions
confirmedContributionsAmount
totalPayments
initiatedPayments
succeededPayments
failedPayments
succeededPaymentsAmount
Dernières contributions

Les 5 plus récentes, avec anonymat respecté.

Derniers paiements

Les 5 plus récents avec :

provider
paymentMethod
status
références PSP
payeur
getEventDashboardSecured(eventId, userId)

Sécurise l’accès au dashboard.

Accès autorisé si
l’utilisateur est l’organizer technique
ou est participant accepté avec rôle :
ORGANIZER
CO_ORGANIZER

Sinon :

throw new ForbiddenException(
  "Vous n'avez pas accès au dashboard de cet événement",
);
Module : EventsModule
Entités enregistrées

Le module injecte les repositories suivants :

Event
User
WishlistItem
Contribution
EventParticipant
Wishlist
Payment
Reservation
Providers
EventsService
EventDashboardService
WishlistItemsService
Exports
EventsService
EventDashboardService
Observation importante

Le module dépend directement de WishlistItemsService, ce qui montre que la lecture métier de la wishlist passe en partie par le module events.

Règles métier effectivement implémentées
1. Création automatique de la wishlist

Chaque événement créé génère automatiquement une wishlist liée.

2. Création automatique du participant organisateur

Le créateur devient automatiquement participant :

rôle ORGANIZER
statut ACCEPTED
3. Share token unique

Chaque événement possède un token d’invitation unique.

4. Gestion des accès par rôle contextuel

Les routes sont protégées selon les rôles :

ORGANIZER
CO_ORGANIZER
GUEST
5. Suppression protégée

La suppression d’un événement est interdite si un paiement réussi existe.

6. Vue enrichie métier côté backend

Le backend calcule directement les permissions utiles au frontend :

réservation possible
contribution possible
état de suppression
paiements en attente
réservations actives
7. Dashboard analytique avancé

Le dashboard fournit déjà de vraies agrégations métier sur :

items
contributions
paiements
Dépendances métier

Le module events dépend de :

users
participants
wishlists
wishlist-items
reservations
contributions
payments
auth
common

Il agit comme un module d’orchestration.

Limites actuelles

Le module ne gère pas encore explicitement :

modification d’un événement
statut d’événement
visibilité publique/privée
fermeture d’événement
anonymat des contributions au niveau événement
devise ou localisation
publication/dépublication

Ces éléments peuvent exister dans la vision cible mais ne sont pas encore présents dans le code actuel.

Résumé

Le module events est un des modules centraux du backend.

Il gère actuellement :

la création d’événement
le token de partage
la création automatique du participant organisateur
la création automatique de la wishlist
l’aperçu public d’un événement
la vue utilisateur enrichie
le dashboard organisateur
la suppression sous conditions

C’est aussi le point de coordination entre plusieurs modules métier majeurs de l’application.
```
