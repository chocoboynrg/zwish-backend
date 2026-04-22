# Users Module

## Rôle du module

Le module `users` gère les comptes utilisateurs globaux de la plateforme.

Il permet de centraliser :

- les informations d’identité de l’utilisateur
- les données de profil
- le rôle global plateforme
- la consultation et la gestion des comptes
- les opérations d’administration sur les utilisateurs

Ce module représente la base fonctionnelle de l’identité utilisateur dans l’application.

---

## Responsabilités principales

Le module `users` couvre les responsabilités suivantes :

### 1. Gestion du compte utilisateur global

Chaque utilisateur possède un compte unique au niveau de la plateforme.

### 2. Gestion du profil

Le module permet de stocker et exposer les informations de profil :

- nom
- prénom
- email
- téléphone
- avatar
- état d’activation
- statut de vérification

### 3. Gestion du rôle plateforme

Le rôle global d’un utilisateur sur la plateforme est porté ici.

Exemples :

- `USER`
- `ADMIN`
- `SUPER_ADMIN`

### 4. Support à l’authentification

Le module `auth` s’appuie généralement sur `users` pour :

- créer les comptes
- rechercher un utilisateur par email
- vérifier les informations du compte
- retourner les données du profil courant

### 5. Support à l’administration

Le module `users` peut être utilisé pour :

- lister les utilisateurs
- consulter un profil
- suspendre ou réactiver un compte
- superviser les comptes de la plateforme

---

## Structure du module

Fichiers présents dans le module :

- `users.module.ts`
- `users.controller.ts`
- `users.service.ts`
- `user.entity.ts`
- `dto/create-user.dto.ts`
- `enums/platform-role.enum.ts`

Cette structure montre que le module est organisé autour :

- d’une entité principale
- d’un service métier
- d’un contrôleur HTTP
- d’un DTO de création
- d’un enum pour les rôles globaux

---

## Position du module dans l’architecture métier

Le module `users` gère **le compte global**.

Important :

- un utilisateur peut être organisateur sur un événement
- ce même utilisateur peut être invité sur un autre événement

Ces rôles **ne doivent pas être stockés dans `users`**.  
Ils sont portés par le module `participants` via la relation `event_participants`.

Autrement dit :

- `users` = identité globale
- `participants` = rôle contextuel par événement

Cette séparation est essentielle pour respecter le modèle métier du projet.

---

## Entité principale : `User`

L’entité `User` représente un compte utilisateur global.

### Champs métier attendus

D’après le modèle fonctionnel et de données, un utilisateur peut contenir les champs suivants :

- `id`
- `firstName`
- `lastName`
- `email`
- `phone`
- `passwordHash`
- `avatarUrl`
- `isActive`
- `isVerified`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

### Rôle de l’entité

Cette entité sert à :

- authentifier l’utilisateur
- stocker son identité
- gérer son profil
- porter son rôle global plateforme

---

## Enum : `PlatformRole`

Le fichier `platform-role.enum.ts` permet de définir les rôles globaux de la plateforme.

### Valeurs prévues

- `USER`
- `ADMIN`
- `SUPER_ADMIN`

### Utilité

Cet enum est utilisé pour :

- restreindre certaines routes d’administration
- différencier les comptes standards des comptes backoffice
- appliquer les règles de sécurité au niveau plateforme

---

## DTO : `CreateUserDto`

Le DTO `CreateUserDto` porte les données nécessaires à la création d’un compte utilisateur.

### Contenu attendu

Selon l’état actuel du projet, il peut inclure :

- email
- password
- name

Et à terme, être enrichi avec :

- firstName
- lastName
- phone
- avatarUrl

### Rôle

Il sert à :

- valider les entrées
- standardiser les créations d’utilisateurs
- protéger le service contre les payloads incomplets ou invalides

---

## Service : `UsersService`

Le `UsersService` contient la logique métier du module.

### Responsabilités typiques

#### Création d’utilisateur

- créer un nouveau compte
- vérifier l’unicité de l’email
- préparer les données avant persistence
- stocker le mot de passe de manière sécurisée

#### Recherche d’utilisateur

- rechercher par id
- rechercher par email
- retrouver le profil courant
- charger les données utiles pour `auth`

#### Mise à jour du profil

- modifier les informations personnelles
- changer l’état du compte
- mettre à jour certains marqueurs métier

#### Support admin

- lister les utilisateurs
- consulter le détail d’un compte
- suspendre / réactiver un utilisateur
- changer un rôle plateforme si nécessaire

---

## Controller : `UsersController`

Le `UsersController` expose les endpoints HTTP du module.

Même si les routes exactes ne sont pas encore toutes décrites dans ton document, le module a vocation à exposer ce type d’actions :

### Endpoints typiques

#### `GET /users/me`

Retourne le profil de l’utilisateur connecté.

#### `PATCH /users/me`

Permet à un utilisateur de modifier son profil.

#### `GET /users`

Retourne la liste des utilisateurs.  
Accès réservé à l’administration.

#### `GET /users/:id`

Retourne le détail d’un utilisateur.  
Accès protégé selon les règles métier.

#### `PATCH /users/:id/status`

Permet de suspendre ou réactiver un compte.  
Route typiquement réservée à `ADMIN` ou `SUPER_ADMIN`.

#### `PATCH /users/:id/role`

Permet de modifier le rôle plateforme d’un utilisateur.  
À réserver aux usages administratifs.

---

## Dépendances avec les autres modules

Le module `users` est transversal et peut être utilisé par plusieurs autres modules.

### `auth`

Le module `auth` dépend de `users` pour :

- créer un compte
- rechercher un utilisateur par email
- charger l’utilisateur courant
- récupérer les données minimales nécessaires au JWT

### `events`

Le module `events` utilise les utilisateurs comme créateurs d’événements.

### `participants`

Le module `participants` associe un utilisateur à un événement avec un rôle contextuel.

### `contributions`

Les contributions sont liées à un utilisateur contributeur.

### `payments`

Les paiements sont liés à un utilisateur payeur.

### `notifications`

Les notifications sont rattachées à un utilisateur destinataire.

### `dashboard`

Le dashboard admin peut agréger des statistiques sur les utilisateurs.

---

## Règles métier importantes

### 1. Le compte utilisateur est global

Le module `users` ne doit pas porter les rôles événementiels.

### 2. Les rôles contextuels appartiennent à `participants`

Un utilisateur peut être :

- `ORGANIZER` sur un événement
- `GUEST` sur un autre

Cette information ne doit pas être fusionnée dans l’entité `User`.

### 3. Le rôle plateforme reste distinct

Le champ `platformRole` permet de distinguer :

- un utilisateur classique
- un administrateur
- un super administrateur

### 4. L’email doit être unique

Deux comptes ne doivent pas partager le même email.

### 5. Le mot de passe ne doit jamais être exposé

Le mot de passe doit être stocké sous forme hashée et jamais renvoyé par l’API.

### 6. Un compte peut être désactivé

Un utilisateur inactif ne doit plus pouvoir accéder normalement à la plateforme selon les règles de sécurité décidées dans `auth`.

---

## Sécurité

Le module `users` manipule des données sensibles.  
Il doit respecter les exigences suivantes :

- validation stricte des entrées
- unicité des identifiants
- hashage des mots de passe
- non exposition des données sensibles
- contrôle d’accès strict sur les routes admin
- journalisation des modifications sensibles si nécessaire

### Points d’attention

- ne jamais retourner `passwordHash`
- protéger les endpoints de listing ou d’édition
- éviter qu’un utilisateur modifie lui-même son `platformRole`
- limiter l’accès aux données d’autres utilisateurs

---

## Exemple de responsabilités dans le projet

### Côté utilisateur standard

Le module permet :

- de créer un compte
- de consulter son profil
- de mettre à jour ses informations

### Côté authentification

Le module fournit :

- la recherche d’un utilisateur par email
- les données utiles à la connexion
- l’état actif / inactif du compte

### Côté administration

Le module permet :

- de superviser les comptes
- de gérer les accès
- de suspendre un utilisateur
- de distinguer les comptes admin des comptes classiques

---

## Exemple d’évolution possible

Le module `users` pourra évoluer avec :

- mise à jour avancée du profil
- upload d’avatar
- vérification email
- vérification téléphone
- historique d’activité
- gestion des devices
- préférences utilisateur
- paramètres de confidentialité
- gestion de suspension / bannissement
- suppression logique de compte

---

## Recommandations techniques

### Base de données

Prévoir au minimum :

- index unique sur `email`
- index sur `platformRole`
- index sur `isActive`

### Modélisation

Préférer :

- un compte utilisateur simple et stable
- des rôles événementiels externalisés dans `participants`
- une séparation claire entre identité, authentification et autorisation

### Format de sortie

Toujours retourner une version nettoyée de l’utilisateur, sans mot de passe ni données sensibles inutiles.

---

## Exemple de réponse API

### Succès

```json
{
  "success": true,
  "message": "Utilisateur récupéré avec succès",
  "data": {
    "id": 1,
    "email": "user@test.com",
    "firstName": "John",
    "lastName": "Doe",
    "platformRole": "USER",
    "isActive": true
  }
}
Erreur
{
  "success": false,
  "message": "Unauthorized",
  "statusCode": 401
}
```
