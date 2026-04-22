# Notifications Module

## Rôle du module

Le module `notifications` gère les notifications envoyées aux utilisateurs.

Il permet de :

- créer une notification
- consulter ses notifications
- marquer une notification comme lue
- marquer toutes les notifications comme lues
- compter les notifications non lues

Ce module est utilisé par plusieurs autres modules pour informer les utilisateurs des événements importants.

---

## Position dans l’architecture

Le module `notifications` est transversal.

Il est utilisé par :

- `product-requests` (soumission, validation, publication)
- `payments` (paiement réussi / échoué)
- potentiellement `events`, `contributions`, etc.

Il sert à :

👉 notifier les utilisateurs  
👉 améliorer l’UX  
👉 centraliser les messages système

---

## Structure du module

- `notifications.module.ts`
- `notifications.controller.ts`
- `notifications.service.ts`
- `notification.entity.ts`
- DTOs :
  - `create-notification.dto.ts`
  - `mark-notification-read.dto.ts`
- Enums :
  - `notification-status.enum.ts`
  - `notification-channel.enum.ts`

---

## Entité : `Notification`

Table : `notifications` :contentReference[oaicite:0]{index=0}

### Champs

- `id`
- `user`
- `event`
- `type`
- `title`
- `body`
- `dataPayload`
- `channel`
- `status`
- `readAt`
- `sentAt`
- `createdAt`

---

## Enum : `NotificationStatus`

```ts
PENDING
SENT
FAILED
READ

Signification
PENDING → en attente d’envoi
SENT → envoyée
FAILED → échec
READ → lue par l’utilisateur
Enum : NotificationChannel
IN_APP
PUSH
EMAIL
SMS

Utilité

Permet de définir le canal de notification :

notification interne (IN_APP)
push mobile
email
SMS
DTOs
CreateNotificationDto
{
  "userId": 1,
  "eventId": 1,
  "type": "PAYMENT_SUCCEEDED",
  "title": "Paiement réussi",
  "body": "Votre paiement a été validé",
  "dataPayload": {},
  "channel": "IN_APP"
}

MarkNotificationReadDto
{
  "note": "optionnel"
}

Controller : NotificationsController

Routes exposées :

POST /notifications
GET /notifications/me
GET /notifications/me/unread-count
GET /notifications/:id
PATCH /notifications/:id/read
PATCH /notifications/me/read-all
Endpoints
POST /notifications

Crée une notification.

Auth
JWT + RolesGuard
Rôles autorisés
ADMIN
SUPER_ADMIN
Traitement
vérifie user
vérifie event (optionnel)
crée notification avec :
status = SENT
sentAt = now
GET /notifications/me

Retourne les notifications de l’utilisateur connecté.

Réponse
{
  "items": [],
  "total": 10,
  "summary": {
    "unreadCount": 3
  }
}
Remarque
dataPayload est automatiquement parsé JSON
GET /notifications/me/unread-count

Retourne le nombre de notifications non lues.

Règle
status = SENT

➡️ considéré comme non lu

GET /notifications/:id

Retourne une notification spécifique.

Règle
accessible uniquement si elle appartient à l’utilisateur

Sinon :

ForbiddenException
PATCH /notifications/:id/read

Marque une notification comme lue.

Traitement
status = READ
readAt = now
Particularité

Si déjà lue → retourne sans modification

PATCH /notifications/me/read-all

Marque toutes les notifications comme lues.

Résultat
{
  "updatedCount": 5
}
Service : NotificationsService

create(dto)

Crée une notification.

Vérifications
utilisateur existe
event valide (optionnel)
Transformation
dataPayload → JSON.stringify
Résultat
status = SENT
findMyNotifications(userId)

Retourne toutes les notifications d’un utilisateur.

Particularité
parse automatiquement dataPayload
findOneAccessible(id, userId)
vérifie existence
vérifie ownership
sinon → Forbidden
markAsRead(id, userId)
vérifie ownership
met à jour statut
met à jour readAt
markAllAsRead(userId)
récupère toutes les notifications
filtre celles non lues
met à jour en batch
countUnread(userId)

Retourne :

{
  "userId": 1,
  "unreadCount": 3
}
Règles métier implémentées
1. Ownership strict

Un utilisateur ne peut voir que ses notifications.

2. Notification = immutable (hors statut)

Le contenu ne change pas, seul le statut évolue.

3. Lecture idempotente

Lire une notification déjà lue ne casse rien.

4. dataPayload structuré

Stocké en string → converti en JSON côté service.

5. Notification instantanée

Création directe avec :

status = SENT
Intégration avec autres modules
product-requests
SUBMITTED
APPROVED
REJECTED
PUBLISHED
payments
paiement réussi
paiement échoué
events
notifications futures possibles
Points forts

✅ simple et efficace
✅ extensible (channels)
✅ sécurisé
✅ centralisé
✅ prêt pour push / email

Limites actuelles
pas de système de queue (async)
pas de push réel (Firebase, etc.)
pas de batching
pas de préférences utilisateur
pas de templates
Évolutions possibles
intégration Firebase / OneSignal
emails transactionnels
préférences utilisateur
notification grouping
suppression / archivage
pagination
Résumé

Le module notifications permet :

d’informer les utilisateurs
de centraliser les événements système
de gérer l’état de lecture

C’est un module transversal essentiel pour l’expérience utilisateur.
```
