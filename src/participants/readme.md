# Participants Module

## Rôle du module

Le module `participants` gère la participation des utilisateurs aux événements.

Il permet de :

- associer un utilisateur à un événement
- gérer les rôles contextuels (organisateur, co-organisateur, invité)
- gérer les statuts de participation
- rejoindre un événement via un lien (shareToken)
- lister les participants d’un événement
- modifier les rôles des participants

Ce module est **central dans la gestion des droits**, car il définit le rôle d’un utilisateur **dans le contexte d’un événement**.

---

## Concept clé

Un utilisateur n’a PAS un rôle global dans la plateforme.

👉 Son rôle dépend de l’événement.

Exemple :

- ORGANIZER sur son propre événement
- GUEST sur celui d’un autre

➡️ Ce module implémente cette logique via la table `event_participants`.

---

## Structure du module

Fichiers présents :

- `participants.module.ts`
- `participants.controller.ts`
- `participants.service.ts`
- `event-participant.entity.ts`
- `enums/participant-role.enum.ts`
- `enums/participant-status.enum.ts`

---

## Entité : `EventParticipant`

Table : `event_participants` :contentReference[oaicite:0]{index=0}

### Champs

- `id`
- `event`
- `user`
- `role`
- `status`
- `joinedAt`
- `createdAt`
- `updatedAt`

### Contrainte importante

```ts
@Unique(['event', 'user'])

➡️ Un utilisateur ne peut participer qu’une seule fois à un événement.

Enum : ParticipantRole
ORGANIZER
CO_ORGANIZER
GUEST

Signification
ORGANIZER : créateur principal
CO_ORGANIZER : gestion partielle
GUEST : simple participant
Enum : ParticipantStatus
INVITED
ACCEPTED
DECLINED
REMOVED

Logique
INVITED → invitation envoyée
ACCEPTED → participation active
DECLINED → refus
REMOVED → exclu
Endpoints exposés
GET /participants/event/:eventId
Auth
JWT requis
Guard : EventRoleGuard
Autorisation
ORGANIZER
CO_ORGANIZER
Description

Retourne tous les participants d’un événement.

Réponse
{
  "items": [...],
  "total": 5
}
PATCH /participants/:id/role
Auth
JWT requis
Description

Met à jour le rôle d’un participant.

Body
{
  "role": "CO_ORGANIZER" | "GUEST"
}
Règles métier
❌ Impossible de modifier son propre rôle
❌ Impossible d’attribuer ORGANIZER
✅ Seulement ORGANIZER / CO_ORGANIZER peuvent modifier
POST /participants/join/:token
Auth
JWT requis
Description

Permet de rejoindre un événement via shareToken.

Comportement

Cas 1 : déjà participant
➡️ met à jour en ACCEPTED

Cas 2 : nouveau participant
➡️ création avec :

rôle GUEST (ou ORGANIZER si owner)
statut ACCEPTED
Service : ParticipantsService
createParticipant()

Crée une participation.

Vérifications
event existe
user existe
pas déjà participant
Comportement
crée avec rôle + statut
joinedAt si accepté
findByEvent(eventId)

Retourne tous les participants d’un événement.

findByUser(userId)

Retourne tous les événements d’un utilisateur.

getParticipantsByEvent(eventId, actorUserId)

Version sécurisée :

vérifie canManageEvent
retourne liste + total
joinByShareToken(token, userId)

🔥 Fonction clé

Étapes
récupérer event via shareToken
vérifier user
vérifier si déjà participant
sinon créer participant
statut = ACCEPTED
joinedAt = now
updateParticipantRole(participantId, role, actorUserId)
Règles importantes
❌ pas auto-modification
❌ pas assigner ORGANIZER
✅ seulement manager peut modifier
getUserRoleInEvent(userId, eventId)

Retourne le participant correspondant.

canManageEvent(userId, eventId)

Privé.

Retourne true si :

status = ACCEPTED
role = ORGANIZER ou CO_ORGANIZER
Sécurité

Le module repose sur :

Guards
JwtAuthGuard
EventRoleGuard
Décorateurs
@EventRoles(...)
Règles métier implémentées
1. Un utilisateur = 1 participation par event

➡️ garanti par contrainte UNIQUE

2. Rejoindre via lien
crée ou met à jour participation
passe en ACCEPTED
3. Rôle ORGANIZER protégé
non assignable via API
seulement créé automatiquement
4. Gestion des droits

Seuls peuvent gérer :

ORGANIZER
CO_ORGANIZER
5. Mise à jour sécurisée des rôles
pas d’auto-modification
contrôle strict des rôles
Dépendances

Le module utilise :

events
users
auth
wishlists (importé mais pas encore utilisé directement)
Points forts du module

✅ séparation claire des rôles
✅ logique métier robuste
✅ gestion des accès propre
✅ join via token bien géré
✅ cohérence avec ton architecture globale

Limites actuelles
pas encore de gestion d’invitations explicites (email, etc.)
pas encore de gestion fine des permissions par action
pas encore de pagination
pas encore de soft delete
Résumé

Le module participants est le cœur du système de rôles.

Il gère :

les relations utilisateur ↔ événement
les rôles contextuels
les accès sécurisés
l’entrée dans un événement via lien

C’est lui qui permet à toute l’architecture de fonctionner correctement.
```
