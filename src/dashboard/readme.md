# Dashboard Module

## Rôle du module

Le module `dashboard` fournit des vues agrégées et analytiques des données de la plateforme.

Il permet de :

- récupérer le dashboard utilisateur
- récupérer le dashboard administrateur
- centraliser les statistiques clés
- exposer les dernières activités (contributions, paiements)

Ce module est conçu pour alimenter directement le frontend (mobile ou web).

---

## Position dans l’architecture

Le module `dashboard` est un module **transversal d’agrégation**.

Il consomme les données de :

- `users`
- `events`
- `participants`
- `contributions`
- `payments`

Il ne modifie pas les données :  
👉 il les agrège et les structure pour l’affichage.

---

## Structure du module

- `dashboard.module.ts`
- `dashboard.controller.ts`
- `dashboard.service.ts`

---

## Controller : `DashboardController`

Routes exposées : :contentReference[oaicite:0]{index=0}

- `GET /dashboard/me`
- `GET /dashboard/admin`

---

### `GET /dashboard/me`

#### Auth

JWT requis

#### Description

Retourne le dashboard personnalisé de l’utilisateur connecté.

#### Délégation

```ts
dashboardService.getMyDashboard(user.userId)
GET /dashboard/admin
Auth

JWT requis

Description

Retourne les statistiques globales de la plateforme.

Remarque

Pas encore protégé par rôle admin dans l’implémentation actuelle.

Service : DashboardService

getMyDashboard(userId)

🔥 Dashboard utilisateur

Étapes principales
1. Vérification utilisateur
if (!user) → NotFoundException
2. Événements organisés
récupère les events où l’utilisateur est organizer
tri DESC
3. Événements rejoints
récupère participations
filtre :
status === ACCEPTED
exclut les événements déjà organisés
4. Statistiques contributions

Requête SQL optimisée :

total contributions
confirmed contributions
awaiting payment
montant total confirmé

Basé sur :
ContributionStatus.CONFIRMED
ContributionStatus.AWAITING_PAYMENT

5. Statistiques paiements
total payments
initiated
succeeded
failed
montant total réussi

Basé sur :
PaymentStatus.INITIATED
PaymentStatus.SUCCEEDED
PaymentStatus.FAILED

6. Dernières contributions

Limité à 5 :

montant
statut
anonymat respecté
event + item liés
7. Derniers paiements

Limité à 5 :

provider
paymentMethod
statut
références PSP
event
Structure de réponse
{
  "user": {},
  "organizedEvents": [],
  "joinedEvents": [],
  "summary": {},
  "latestContributions": [],
  "latestPayments": []
}
getAdminDashboard()

🔥 Dashboard global plateforme

Statistiques globales
totalUsers
totalEvents
totalWishlists
totalWishlistItems
Statistiques contributions
total
confirmed
awaiting
failed
montant total confirmé
Statistiques paiements
total
initiated
succeeded
failed
montant total réussi
Dernières contributions

Limité à 10 :

contributor (si non anonyme)
event
item
Derniers paiements

Limité à 10 :

payer
event
provider
statut
Module : DashboardModule

Entités utilisées
User
Event
EventParticipant
Contribution
Payment
Providers
DashboardService
Controllers
DashboardController
Règles métier implémentées
1. Séparation user / admin
getMyDashboard → utilisateur
getAdminDashboard → global
2. Exclusion événements doublons

Un événement organisé n’est pas compté comme participation.

3. Filtrage participation valide

Seuls les participants :

status === ACCEPTED

sont pris en compte

4. Agrégations SQL optimisées

Utilisation de :

SUM(CASE WHEN ...)
COUNT(...)

➡️ très performant

5. Conversion types SQL → JS
Number(...)

➡️ évite les bugs string

6. Respect anonymat

Contributeur masqué si :

isAnonymous === true
Points forts

✅ requêtes optimisées
✅ agrégation complète
✅ prêt pour dashboard UI
✅ séparation user/admin
✅ performant

Limites actuelles
pas de pagination
pas de filtres temporels (jour, mois, etc.)
pas de cache (Redis)
pas de métriques temps réel
endpoint admin non sécurisé (pas de RolesGuard)
Évolutions possibles
graphiques (time series)
filtres (date range)
KPI avancés
cache Redis
alertes
analytics temps réel
Résumé

Le module dashboard fournit une vue synthétique de la plateforme.

Il permet :

à un utilisateur de suivre ses activités
à un admin de suivre la plateforme
d’agréger les données critiques
d’alimenter le frontend en données prêtes à afficher

C’est la couche analytique du backend.
```
