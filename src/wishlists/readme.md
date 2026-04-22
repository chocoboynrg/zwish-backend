# Wishlists Module

## Rôle du module

Le module `wishlists` gère les listes de souhaits associées aux événements.

Dans l’état actuel du projet, il permet principalement de :

- créer une wishlist liée à un événement
- récupérer toutes les wishlists enregistrées
- stocker la relation entre une wishlist et son événement

Ce module est aujourd’hui volontairement simple.  
La logique métier la plus avancée autour de l’affichage et de l’exploitation de la wishlist est portée par d’autres modules, notamment :

- `events`
- `wishlist-items`

---

## Position du module dans l’architecture

Une wishlist représente le conteneur logique des items d’un événement.

Dans ton architecture actuelle :

- un événement peut avoir une wishlist associée
- la wishlist stocke les informations de base
- les éléments concrets affichés aux utilisateurs sont gérés dans `wishlist-items`

Autrement dit :

- `wishlists` = conteneur
- `wishlist-items` = contenu métier exploitable

---

## Structure du module

Fichiers présents :

- `wishlists.module.ts`
- `wishlists.controller.ts`
- `wishlists.service.ts`
- `wishlist.entity.ts`

---

## Entité : `Wishlist`

Table : `wishlists` :contentReference[oaicite:2]{index=2}

### Champs actuels

- `id`
- `title`
- `description`
- `event`

### Relation

#### `event`

Chaque wishlist est liée à un événement via une relation `ManyToOne`.

```ts
@ManyToOne(() => Event, { eager: true, onDelete: 'CASCADE' })
event: Event;
Remarques
la relation est chargée en eager
si l’événement est supprimé, la wishlist est supprimée automatiquement grâce à onDelete: 'CASCADE'
Observation importante

Dans la modélisation métier cible, on parle souvent d’une wishlist par événement.
Mais dans le code actuel, il n’y a pas encore de contrainte d’unicité sur event dans l’entité Wishlist.
Donc techniquement, plusieurs wishlists pourraient être créées pour un même événement si rien ne l’empêche côté service.

Controller : WishlistsController

Le contrôleur expose actuellement deux routes :

GET /wishlists
POST /wishlists

GET /wishlists

Retourne toutes les wishlists.

Comportement

Le contrôleur délègue simplement à :

wishlistsService.getAllWishlists()
Remarque

Cette route n’est pas encore protégée par authentification ou autorisation dans l’implémentation actuelle.
Elle retourne les wishlists telles qu’elles existent en base.

POST /wishlists

Crée une wishlist.

Body attendu
{
  "title": "Ma wishlist",
  "eventId": 1,
  "description": "Liste de souhaits de l'événement"
}
Comportement

Le contrôleur délègue à :

wishlistsService.createWishlist(title, eventId, description)
Traitement métier
vérifie que l’événement existe
crée une wishlist liée à cet événement
enregistre la wishlist en base
Remarque

Cette route n’est pas encore protégée par auth dans sa version actuelle.

Service : WishlistsService

Le service contient une logique simple de lecture et création.

Méthodes présentes
getAllWishlists()

Retourne toutes les wishlists enregistrées.

return this.wishlistsRepository.find();

Comme la relation event est en eager, l’événement est disponible avec la wishlist.

createWishlist(title, eventId, description?)

Crée une nouvelle wishlist.

Étapes
recherche l’événement avec eventId
lève une NotFoundException si l’événement n’existe pas
crée l’instance Wishlist
sauvegarde en base
Exception possible
throw new NotFoundException('Event not found');
Remarque importante

Le service ne vérifie pas encore si une wishlist existe déjà pour cet événement.
Donc la règle “une seule wishlist par événement” n’est pas encore imposée ici.

Module : WishlistsModule

Le module enregistre :

Entities utilisées
Wishlist
Event
Providers
WishlistsService
Controllers
WishlistsController

Dépendances

Le module dépend directement de :

events : pour lier une wishlist à un événement

Et indirectement, la wishlist est utilisée par :

events : création automatique lors de la création d’un événement
wishlist-items : les items appartiennent à une wishlist
Règles métier effectivement observées
1. Une wishlist appartient à un événement

La relation entre wishlist et événement est bien implémentée.

2. La suppression de l’événement supprime la wishlist

Cela est garanti par onDelete: 'CASCADE'.

3. La création manuelle est possible

Le module expose une route dédiée à la création de wishlist.

4. Aucune règle d’unicité n’est encore imposée

À ce stade, rien n’empêche plusieurs wishlists pour un même événement au niveau de ce module.

Relation avec le module events

Dans ton projet actuel, la création principale d’une wishlist ne semble pas passer d’abord par POST /wishlists, mais par le module events.

Lorsqu’un événement est créé, EventsService.createEvent() crée automatiquement :

l’événement
le participant organisateur
la wishlist liée

Cela veut dire que dans le flux métier principal :

events orchestre
wishlists persiste

C’est un détail important pour bien comprendre l’architecture actuelle.

Limites actuelles du module

Le module est encore minimal et ne gère pas encore :

l’unicité d’une wishlist par événement
la mise à jour d’une wishlist
la suppression d’une wishlist
les contrôles d’accès
les réponses standardisées avec buildSuccessResponse
la validation DTO dédiée
les permissions organisateur / co-organisateur
Évolutions naturelles possibles

Ce module pourra évoluer pour intégrer :

un CreateWishlistDto
un UpdateWishlistDto
une contrainte d’unicité sur l’événement
une route GET /wishlists/:id
une route PATCH /wishlists/:id
une route DELETE /wishlists/:id
la protection JWT
le contrôle de rôle contextuel
une réponse API standardisée
Point d’attention architectural

Aujourd’hui, la logique “wishlist visible de l’événement” semble surtout consommée depuis :

GET /events/:id/wishlist
GET /events/:id/my-view

Cela montre que la vraie lecture métier passe davantage par le module events ou wishlist-items que par wishlists lui-même.

Donc ce module joue pour l’instant davantage un rôle de support structurel que de cœur métier autonome.

Résumé

Le module wishlists gère actuellement la structure de base des listes de souhaits.

Il permet :

de créer une wishlist liée à un événement
de récupérer les wishlists existantes
de persister la relation entre wishlist et événement

Dans l’architecture actuelle, il reste simple et sert surtout de fondation aux modules plus riches comme events et wishlist-items.
```
