# Contributions Module

## Rôle du module

Le module `contributions` gère les participations financières des utilisateurs sur les items d’une wishlist.

Il permet de :

- créer une contribution
- initier un paiement associé
- confirmer ou échouer une contribution
- consulter ses contributions
- consulter les contributions d’un événement (organisateur)
- maintenir la cohérence du financement des items

Ce module est le cœur du système de financement de la plateforme.

---

## Position dans l’architecture

Le module `contributions` connecte plusieurs domaines clés :

- `wishlist-items` (objet financé)
- `payments` (transaction financière)
- `reservations` (conflits métier)
- `participants` (droits d’accès)
- `events` (contexte global)

Il pilote directement :

- `fundedAmount`
- `remainingAmount`
- `fundingStatus`

---

## Structure du module

Fichiers présents :

- `contributions.module.ts`
- `contributions.controller.ts`
- `contributions.service.ts`
- `contribution.entity.ts`
- `dto/create-contribution.dto.ts`
- `dto/confirm-contribution.dto.ts`
- `enums/contribution-status.enum.ts`

---

## Entité : `Contribution`

Table : `contributions` :contentReference[oaicite:0]{index=0}

### Champs

- `id`
- `event`
- `wishlistItem`
- `contributor`
- `amount`
- `currencyCode`
- `isAnonymous`
- `status`
- `message`
- `confirmedAt`
- `cancelledAt`
- `createdAt`
- `updatedAt`

### Relations

- `event`
- `wishlistItem`
- `contributor`
- `payments`

---

## Enum : `ContributionStatus`

```ts
PENDING
AWAITING_PAYMENT
CONFIRMED
FAILED
CANCELLED
REFUNDED

Signification
AWAITING_PAYMENT → paiement en attente
CONFIRMED → paiement validé
FAILED → paiement échoué
CANCELLED → annulé
REFUNDED → remboursé
DTO : CreateContributionDto
{
  "wishlistItemId": 1,
  "amount": 10000,
  "currencyCode": "XOF",
  "isAnonymous": false,
  "message": "Félicitations !"
}

Remarque importante

contributorUserId est injecté côté backend :

contributorUserId: user.userId
Controller : ContributionsController

Routes exposées :

POST /contributions
GET /contributions/me
GET /contributions/event/:eventId
PATCH /contributions/:id/confirm
PATCH /contributions/:id/fail
POST /contributions/checkout

Toutes protégées par JwtAuthGuard.

Endpoints
POST /contributions

Crée une contribution.

Traitement
valide item
valide utilisateur
vérifie règles métier
crée contribution avec status :
AWAITING_PAYMENT
POST /contributions/checkout

🔥 Endpoint clé

Crée :

contribution
paiement associé
Transaction
dataSource.transaction(...)
Résultat
{
  "contribution": {},
  "payment": {}
}
GET /contributions/me

Retourne les contributions de l’utilisateur.

Filtres
status=CONFIRMED
status=AWAITING_PAYMENT
status=ALL
Réponse enrichie
event
item
payment
résumé global
GET /contributions/event/:eventId

Réservé aux organisateurs.

Règles
ORGANIZER ou CO_ORGANIZER
participant ACCEPTED
Données
contributions
contributor (si non anonyme)
payment
PATCH /contributions/:id/confirm

Confirme une contribution.

Effets
status → CONFIRMED
confirmedAt → now
recalcul financement item
PATCH /contributions/:id/fail

Marque une contribution comme échouée.

Service : ContributionsService
create(dto)

Crée une contribution.

Règles métier de création
1. Item valide
2. Item non déjà financé
fundingStatus !== FUNDED
3. Pas de contribution en attente
AWAITING_PAYMENT / PENDING

➡️ 1 seule contribution active par item

4. Respect réservation

Si EXCLUSIVE :

réservé par autre → interdit
5. Montant valide

0

≤ remainingAmount
Résultat

Contribution créée avec :

status = AWAITING_PAYMENT
confirm(id)

🔥 Fonction critique

Étapes
validation statut
validation montant
mise à jour :
status = CONFIRMED
recalcul item
recalculateWishlistItemFunding()

🔥 Fonction centrale

Met à jour :

fundedAmount
remainingAmount
fundingStatus
Règles
if total == 0 → NOT_FUNDED
if total < target → PARTIALLY_FUNDED
if total >= target → FUNDED
checkoutContribution()

🔥 Workflow complet

vérifie pas de contribution en attente
crée contribution
crée paiement
getUserContributions()

Retour enrichi :

contributions
dernier paiement
résumé :
{
  "totalCount": 10,
  "confirmedCount": 5,
  "awaitingPaymentCount": 2,
  "failedCount": 1,
  "totalConfirmedAmount": 50000
}
getContributionsByEvent()

Accessible si :

ORGANIZER
CO_ORGANIZER
Règles métier implémentées
1. Une seule contribution en attente par item
2. Contribution impossible si item financé
3. Respect des réservations
4. Cohérence financière automatique
recalcul après confirmation
5. Contribution liée au paiement
création via checkout
6. Anonymat respecté
7. Accès sécurisé
utilisateur → ses contributions
organisateur → event
Intégration avec les autres modules
wishlist-items
mise à jour financement
reservations
bloque contribution si réservé par autre
payments
lié à contribution
events
utilisé dans dashboard + my-view
Points forts du module

✅ logique métier complète
✅ cohérence financière forte
✅ protection des conflits
✅ gestion paiement intégrée
✅ architecture transactionnelle

Limites actuelles
pas encore de refund réel
pas de webhook PSP
pas de gestion multi-devise avancée
pas de retry paiement
pas de timeout automatique
Résumé

Le module contributions est le cœur financier de la plateforme.

Il gère :

la création des contributions
leur validation via paiement
la cohérence du financement
la relation avec les items
les règles métier critiques

C’est le module qui transforme une wishlist en expérience réelle de financement.
```
