Voici le README auth prêt à copier-coller :

# Auth Module

## Rôle du module

Le module `auth` gère :

- l’inscription
- la connexion
- l’authentification JWT
- la récupération du profil connecté
- les contrôles d’accès globaux
- les contrôles d’accès contextuels par événement

Il constitue le socle de sécurité du backend.

---

## Structure du module

Fichiers présents :

- `auth.module.ts`
- `auth.controller.ts`
- `auth.service.ts`
- `jwt.strategy.ts`
- `jwt-auth.guard.ts`
- `roles.guard.ts`
- `roles.decorator.ts`
- `event-role.guard.ts`
- `event-roles.decorator.ts`
- `current-user.decorator.ts`
- `jwt-user.type.ts`
- `dto/register.dto.ts`
- `dto/login.dto.ts`

---

## Rôle du module dans l’architecture

Le module `auth` ne se limite pas à la connexion.

Il gère deux niveaux de contrôle d’accès :

### 1. Rôles plateforme

Exemples :

- `USER`
- `ADMIN`
- `SUPER_ADMIN`

### 2. Rôles événementiels

Exemples :

- `ORGANIZER`
- `CO_ORGANIZER`
- `GUEST`

Cette séparation est importante car :

- le rôle plateforme est global au compte
- le rôle événementiel dépend de chaque événement

---

## DTOs

### `RegisterDto`

Champs validés :

- `name`
- `email`
- `password`

#### Règles

- `name` obligatoire, max 120
- `email` valide, max 190
- `password` entre 6 et 100 caractères

---

### `LoginDto`

Champs validés :

- `email`
- `password`

#### Règles

- `email` valide, max 190
- `password` entre 6 et 100 caractères

---

## Type `JwtUser`

Le type `JwtUser` représente l’utilisateur injecté dans la requête après validation du JWT.

### Champs

- `userId`
- `email`
- `name`
- `platformRole`

Ce type est utilisé dans :

- `CurrentUser`
- `RolesGuard`
- `EventRoleGuard`
- les contrôleurs protégés

---

## Controller : `AuthController`

Routes exposées :

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Toutes les réponses utilisent le formalisme standard via :

- `buildActionResponse`
- `buildItemResponse`

---

### `POST /auth/register`

Crée un compte utilisateur et retourne immédiatement un token JWT.

#### Body attendu

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123"
}
Comportement
normalise le nom et l’email
vérifie l’unicité de l’email
hash le mot de passe avec bcrypt
crée l’utilisateur
génère un JWT
retourne :
accessToken
user
Réponse
{
  "success": true,
  "message": "Inscription réussie",
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "platformRole": "USER"
    }
  }
}
POST /auth/login

Authentifie un utilisateur et retourne un token JWT.

Body attendu
{
  "email": "john@example.com",
  "password": "secret123"
}
Comportement
normalise l’email
charge l’utilisateur avec son mot de passe
compare le mot de passe avec bcrypt.compare
génère un JWT
retourne :
accessToken
user
Réponse
{
  "success": true,
  "message": "Connexion réussie",
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "platformRole": "USER"
    }
  }
}
GET /auth/me

Retourne le profil de l’utilisateur connecté.

Auth

JWT requis via JwtAuthGuard.

Comportement
récupère l’utilisateur courant avec @CurrentUser()
charge le profil via authService.getProfile(user.userId)
Réponse
{
  "success": true,
  "message": "Profil récupéré avec succès",
  "data": {
    "item": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "platformRole": "USER"
    }
  }
}
Service : AuthService

Le AuthService contient la logique métier d’authentification.

Dépendances
UsersService
JwtService
register(name, email, password)
Étapes
normalise email et name
vérifie si l’email existe déjà
vérifie que le nom n’est pas vide
vérifie la longueur minimale du mot de passe
hash le mot de passe avec bcrypt.hash(..., 10)
crée l’utilisateur via usersService.createUserWithPassword(...)
génère un JWT
retourne token + infos utilisateur
Payload JWT généré
{
  sub: user.id,
  email: user.email,
  name: user.name,
  platformRole: user.platformRole
}
login(email, password)
Étapes
normalise l’email
charge l’utilisateur avec mot de passe
compare le mot de passe hashé
génère un JWT
retourne token + user
Erreur possible
UnauthorizedException('Email ou mot de passe invalide')
getProfile(userId)

Retourne un profil sécurisé :

id
name
email
platformRole

Aucune donnée sensible n’est exposée.

JWT Strategy

Le module utilise Passport avec une stratégie JWT personnalisée.

Source du token

Le token est lu depuis :

ExtractJwt.fromAuthHeaderAsBearerToken()
Secret JWT

Le secret vient de :

process.env.JWT_SECRET si défini
sinon dev-secret-change-me en environnement non production
en production, l’absence de JWT_SECRET provoque une erreur
Validation du payload

Le payload doit obligatoirement contenir :

sub
email
name
platformRole

Sinon :

UnauthorizedException('Jeton invalide')
Transformation

Le payload est transformé en JwtUser.

JwtAuthGuard

Le guard JWT repose sur :

AuthGuard('jwt')

Il protège les routes qui nécessitent un utilisateur authentifié.

Exemples :

/auth/me
/events
/contributions
/payments
/notifications/me
CurrentUser decorator

Le décorateur @CurrentUser() permet de récupérer l’utilisateur authentifié directement dans un contrôleur.

Exemple
@Get('me')
@UseGuards(JwtAuthGuard)
async me(@CurrentUser() user: JwtUser) {
  return user;
}
Rôles plateforme
Roles decorator

Le décorateur @Roles(...) permet d’indiquer quels rôles plateforme sont autorisés sur une route.

Exemple
@Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
RolesGuard

Le RolesGuard lit les rôles requis via le metadata ROLES_KEY.

Vérifications
l’utilisateur doit être présent
platformRole doit être présent
le rôle de l’utilisateur doit être inclus dans les rôles autorisés
Erreurs possibles
ForbiddenException('Rôle utilisateur introuvable')
ForbiddenException('Accès refusé')
Rôles événementiels
EventRoles decorator

Le décorateur @EventRoles(...) permet de déclarer les rôles autorisés dans un contexte d’événement.

Exemple
@EventRoles(ParticipantRole.ORGANIZER, ParticipantRole.CO_ORGANIZER)
EventRoleGuard

Le EventRoleGuard protège les routes dépendant d’un événement.

C’est une pièce très importante du module.

Ce qu’il fait
1. Récupère les rôles événementiels requis

via EVENT_ROLES_KEY

2. Vérifie la présence d’un utilisateur authentifié
3. Détermine l’eventId cible

Il sait retrouver l’événement de deux façons :

Cas 1 : paramètres d’URL
params.eventId
params.id
Cas 2 : wishlistId dans le body

Si aucune route ne donne directement eventId, il charge la wishlist et récupère son événement.

C’est particulièrement utile pour des routes comme :

POST /wishlist-items
4. Charge l’événement
5. Autorise automatiquement le propriétaire technique

Si l’utilisateur est l’organizer technique de l’événement et que ORGANIZER est autorisé, le guard laisse passer.

6. Vérifie la participation
l’utilisateur doit être participant
le statut doit être ACCEPTED
le rôle doit faire partie des rôles autorisés
Erreurs possibles
utilisateur non authentifié
impossible de déterminer l’événement
événement introuvable
utilisateur non participant
participation non active
rôle non autorisé
Module : AuthModule
Imports
UsersModule
TypeOrmModule.forFeature([User, EventParticipant, Event, Wishlist])
JwtModule.register(...)
Providers
AuthService
JwtStrategy
EventRoleGuard
Exports
AuthService
EventRoleGuard
Remarque

Le JwtModule est configuré avec :

un secret JWT
une durée de vie du token de 7d
Règles métier effectivement implémentées
1. Inscription immédiate avec token

L’utilisateur n’a pas besoin de se reconnecter après inscription.

2. Email normalisé

Les emails sont toujours trim + lowercase avant vérification.

3. Mot de passe hashé

Le mot de passe est hashé avec bcryptjs.

4. Payload JWT enrichi

Le token contient :

id
email
nom
rôle plateforme
5. Séparation nette entre rôles plateforme et rôles événementiels

C’est un point fort de ton architecture.

6. Contrôle d’accès contextuel intelligent

Le EventRoleGuard sait déduire l’événement même via une wishlistId, ce qui évite beaucoup de duplication dans les contrôleurs.

Points forts du module
auth simple et propre
JWT bien structuré
contrôle d’accès global + contextuel
bon usage de Passport
bonne séparation des responsabilités
compatible avec toute l’architecture événementielle
Limites actuelles

Le module ne gère pas encore :

refresh token
logout serveur
reset password
vérification email
MFA
blacklist de token
throttling dédié auth
Résumé

Le module auth fournit tout le socle de sécurité du backend.

Il gère :

l’inscription
la connexion
la validation JWT
le profil connecté
les rôles plateforme
les rôles événementiels

C’est un module central, transverse, et particulièrement bien adapté à ton architecture basée sur des rôles contextuels.
```
