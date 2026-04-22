# Payments Module

## Rôle du module

Le module `payments` gère les transactions financières liées aux contributions.

Il permet de :

- initialiser un paiement
- marquer un paiement comme réussi ou échoué
- traiter les webhooks des providers
- synchroniser les contributions et les items financés
- notifier les utilisateurs

C’est le module qui transforme une contribution en paiement réel.

---

## Position dans l’architecture

Le module `payments` est connecté à :

- `contributions` (source métier)
- `wishlist-items` (impact financier)
- `events` (contexte)
- `users` (payeur)
- `notifications` (feedback utilisateur)

Il est responsable de la transition :

👉 contribution → paiement → confirmation → mise à jour financement

---

## Structure du module

- `payments.module.ts`
- `payments.controller.ts`
- `payments.service.ts`
- `payment.entity.ts`
- DTOs :
  - `create-payment.dto.ts`
  - `mark-payment-succeeded.dto.ts`
  - `mark-payment-failed.dto.ts`
  - `payment-webhook.dto.ts`
- Enums :
  - `payment-status.enum.ts`
  - `payment-provider.enum.ts`
  - `payment-method.enum.ts`

---

## Entité : `Payment`

Table : `payments` :contentReference[oaicite:0]{index=0}

### Champs

- `id`
- `contribution`
- `payer`
- `provider`
- `providerTransactionId`
- `providerReference`
- `paymentMethod`
- `amount`
- `currencyCode`
- `status`
- `paymentUrl`
- `failureReason`
- `initiatedAt`
- `confirmedAt`
- `failedAt`
- `refundedAt`
- `rawProviderPayload`
- `createdAt`
- `updatedAt`

---

## Enum : `PaymentStatus`

```ts
INITIATED
PENDING
SUCCEEDED
FAILED
CANCELLED
REFUNDED

Enum : PaymentProvider
STRIPE
FLUTTERWAVE
MOBILE_MONEY
OTHER

Enum : PaymentMethod
CARD
MOBILE_MONEY
BANK_TRANSFER
WALLET

DTOs
CreatePaymentDto
{
  "contributionId": 1,
  "provider": "STRIPE",
  "paymentMethod": "CARD"
}

MarkPaymentSucceededDto
providerTransactionId
providerReference
note

MarkPaymentFailedDto
failureReason
note

PaymentWebhookDto
{
  "provider": "STRIPE",
  "paymentId": 1,
  "status": "SUCCEEDED"
}

Controller : PaymentsController

Routes :

POST /payments
GET /payments
GET /payments/me
GET /payments/:id
PATCH /payments/:id/succeed
PATCH /payments/:id/fail
POST /payments/webhook
Endpoints
POST /payments

Crée un paiement.

Règles
payer = contributor
contribution non confirmée
pas de paiement déjà réussi
GET /payments

Retourne paiements accessibles :

les siens
ceux des events qu’il gère
GET /payments/me

Retour enrichi :

paiement
contribution
event
item
résumé global
GET /payments/:id

Accès :

propriétaire
ou organisateur event
PATCH /payments/:id/succeed

🔥 Fonction critique

Transaction
paiement → SUCCEEDED
contribution → CONFIRMED
recalcul item
Notifications envoyées :
au contributeur
à l’organisateur
PATCH /payments/:id/fail
Effets
paiement → FAILED
contribution → FAILED (si en attente)
POST /payments/webhook
Sécurité

Header requis :

x-webhook-secret
Traitement
met à jour paiement
appelle :
markAsSucceeded
ou markAsFailed
Service : PaymentsService
create(dto)

Crée un paiement.

Vérifications
contribution existe
payer valide
payer = contributor
contribution non confirmée
pas de paiement déjà réussi
Résultat
status = INITIATED
markAsSucceeded(id)

🔥 Fonction la plus importante

Étapes
validation paiement
validation contribution
validation montant
mise à jour :
payment.status = SUCCEEDED
contribution.status = CONFIRMED
recalcul financement item
markAsFailed(id)
Effets
payment.status = FAILED
contribution.status = FAILED
handleWebhook(dto)

🔥 Intégration PSP

valide payload
enregistre raw payload
route vers success/fail
getMyPayments(userId)

Retour structuré :

paiements
contribution
event
item
résumé
findAccessible(userId)

Accès :

payer
organisateur/co-organisateur
Règles métier implémentées
1. Un paiement = une contribution
2. Paiement unique réussi
3. Synchronisation automatique
paiement → contribution → item
4. Sécurité forte
ownership
rôle événement
5. Transaction critique
paiement + contribution + item
6. Webhook sécurisé
7. Notifications intégrées

Après succès :

contributeur notifié
organisateur notifié
Intégration avec autres modules
contributions
lié 1-N
wishlist-items
mise à jour financement
events
dashboard
notifications
événements système
Points forts

✅ transaction complète
✅ cohérence métier totale
✅ webhook ready
✅ notification intégrée
✅ architecture scalable

Limites actuelles
pas de vrai provider branché (Stripe, etc.)
pas de retry paiement
pas de gestion refund réelle
pas de gestion async webhook avancée
pas de multi-step checkout
Résumé

Le module payments gère toute la couche financière :

création des paiements
validation / échec
synchronisation avec contribution
mise à jour des items
notifications

C’est la brique finale qui rend le système réellement transactionnel.
```
