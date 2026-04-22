# Reservations Module

## Rôle du module

Le module `reservations` gère la réservation des items d’une wishlist.

Il permet de :

- réserver un item
- consulter ses réservations
- consulter le détail d’une réservation
- libérer une réservation
- maintenir la cohérence entre réservation et état de l’item (`isReserved`)

Ce module est essentiel pour éviter les conflits entre utilisateurs sur un même item.

---

## Position dans l’architecture

Le module `reservations` est directement lié à :

- `wishlist-items` (objet réservé)
- `events` (contexte)
- `users` (réservant)
- `contributions` (impact métier sur réservation)

Il influence directement :

- `item.isReserved`
- `canReserve` (dans `events/my-view`)
- `canContribute`

---

## Structure du module

Fichiers présents :

- `reservations.module.ts`
- `reservations.controller.ts`
- `reservations.service.ts`
- `reservation.entity.ts`
- `dto/create-reservation.dto.ts`
- `dto/release-reservation.dto.ts`
- `enums/reservation-status.enum.ts`

---

## Entité : `Reservation`

Table : `reservations` :contentReference[oaicite:0]{index=0}

### Champs

- `id`
- `wishlistItem`
- `event`
- `reservedBy`
- `status`
- `reservedAt`
- `expiresAt`
- `releasedAt`
- `releaseReason`
- `createdAt`
- `updatedAt`

### Relations

- `wishlistItem`
- `event`
- `reservedBy` (user)

---

## Enum : `ReservationStatus`

```ts
ACTIVE
EXPIRED
RELEASED
CONFIRMED

Signification
ACTIVE → réservation en cours
RELEASED → libérée par l’utilisateur
EXPIRED → expirée (non encore utilisé)
CONFIRMED → validée (potentiellement après contribution)
DTO : CreateReservationDto
{
  "wishlistItemId": 1,
  "eventId": 1,
  "reservedByUserId": 1
}

Remarque importante

Dans le controller, reservedByUserId est injecté automatiquement :

reservedByUserId: user.userId

➡️ Sécurisé côté backend.

DTO : ReleaseReservationDto
{
  "reason": "Je ne peux plus participer"
}

Controller : ReservationsController

Routes exposées :

GET /reservations
GET /reservations/:id
POST /reservations
PATCH /reservations/:id/release

Toutes protégées par JwtAuthGuard.

GET /reservations

Retourne les réservations de l’utilisateur connecté.

Réponse
{
  "items": [],
  "total": 0
}
GET /reservations/:id

Retourne une réservation spécifique.

Règles
accessible uniquement si elle appartient à l’utilisateur

Sinon :

ForbiddenException
POST /reservations

Crée une réservation.

Auth

JWT requis.

Body
{
  "wishlistItemId": 1,
  "eventId": 1
}
Traitement métier

La création se fait dans une transaction :

manager.transaction(...)
Règles métier de création
1. Item valide
doit exister
doit appartenir à l’événement
2. Mode de réservation autorisé
if (item.reservationMode === NONE)

➡️ rejet

3. Pas de contribution confirmée
ContributionStatus.CONFIRMED

➡️ interdit de réserver un item déjà financé

4. Mode EXCLUSIVE

Si déjà réservé :

par moi → erreur "Déjà réservé par vous"
par quelqu’un d’autre → erreur "Déjà réservé"
5. Création
status = ACTIVE
reservedAt = now
6. Mise à jour de l’item
item.isReserved = true

➡️ cohérence garantie

PATCH /reservations/:id/release

Libère une réservation.

Auth

JWT requis

Règles métier
1. La réservation doit exister
2. Elle doit appartenir à l’utilisateur
3. Elle doit être ACTIVE
4. Mise à jour
status = RELEASED
releasedAt = now
releaseReason = dto.reason
5. Mise à jour de l’item

Si plus aucune réservation active :

item.isReserved = false
Service : ReservationsService
create(dto)

🔥 Fonction critique

Points clés
transaction SQL
validation forte
cohérence item ↔ réservation
protection contre conflits
findAllByUser(userId)

Retourne :

toutes les réservations d’un user
triées DESC
findOneForUser(id, userId)
vérifie ownership
sinon ForbiddenException
releaseForUser(id, userId, dto)

🔥 Libération sécurisée

transaction
vérifie ownership
met à jour statut
met à jour item si nécessaire
Module : ReservationsModule
Entités injectées
Reservation
WishlistItem
Event
User
Providers
ReservationsService
Exports
ReservationsService
Règles métier implémentées
1. Réservation exclusive

Un item EXCLUSIVE ne peut avoir qu’une seule réservation ACTIVE.

2. Réservation impossible si contribution confirmée

➡️ évite incohérence paiement / réservation

3. Synchronisation automatique avec item
réservation → isReserved = true
libération → recalcul
4. Ownership strict

Un utilisateur ne peut :

voir que ses réservations
libérer que ses réservations
5. Transaction obligatoire

Création et libération sont transactionnelles.

Points forts du module

✅ gestion des conflits solide
✅ cohérence data garantie
✅ logique métier claire
✅ protection forte
✅ intégration parfaite avec wishlist-items

Limites actuelles
pas encore de gestion d’expiration (expiresAt)
pas encore de réservation collaborative réelle
pas encore de confirmation automatique après paiement
pas de pagination
pas de webhook ou event
Résumé

Le module reservations gère la réservation des items avec une logique métier robuste.

Il assure :

la réservation exclusive ou contrôlée
la cohérence avec les contributions
la synchronisation avec l’état des items
la sécurité des accès utilisateur

C’est un module critique pour éviter les conflits entre participants.
```
