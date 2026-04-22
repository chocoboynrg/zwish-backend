POST /auth/register

Créer un utilisateur

{
"email": "user@test.com",
"password": "password",
"name": "User"
}

POST /auth/login
{
"email": "user@test.com",
"password": "password"
}

Response

{
"success": true,
"data": {
"accessToken": "jwt_token"
}
}
GET /auth/me

Auth requis

Authorization: Bearer <token>
👥 Events
POST /events

Créer un événement
Auth requis

{
"title": "Anniversaire",
"description": "Fête",
"eventDate": "2026-05-01"
}

Crée automatiquement une wishlist

GET /events/:id/my-view

Auth requis

Retourne :

{
"event": { ... },
"wishlist": [...],
"accessRole": "ORGANIZER | CO_ORGANIZER | GUEST",
"summary": { ... }
}
POST /events/:id/invite-link

ORGANIZER uniquement

POST /events/join

Rejoindre un event via token

{
"token": "invite_token"
}
Wishlist
POST /wishlist-items

ORGANIZER / CO_ORGANIZER

{
"wishlistId": 1,
"name": "TV",
"price": 200000,
"quantity": 1
}
Reservations
POST /reservations

Auth

{
"wishlistItemId": 1,
"eventId": 1
}
Contributions
POST /contributions

Auth

{
"wishlistItemId": 1,
"amount": 5000,
"currencyCode": "XOF",
"isAnonymous": false,
"message": "Bonne fête"
}
Payments
POST /payments

Auth

{
"contributionId": 1,
"provider": "OTHER",
"paymentMethod": "MOBILE_MONEY"
}

Response

{
"data": {
"payment": {
"id": 1,
"paymentUrl": "https://..."
}
}
}
My Contributions
GET /contributions/me?status=CONFIRMED

Auth

Product Requests (User)
POST /product-requests

ORGANIZER / CO_ORGANIZER

{
"wishlistId": 1,
"name": "PS5",
"estimatedPrice": 300000,
"description": "Console",
"currencyCode": "XOF"
}
Admin Product Requests
GET /product-requests

ADMIN

PATCH /product-requests/:id/review
{
"status": "APPROVED",
"categoryId": 1,
"approvedProductName": "PlayStation 5",
"approvedProductSlug": "playstation-5"
}
PATCH /product-requests/:id/publish
{
"name": "PS5",
"price": 300000,
"quantity": 1
}

Crée un item dans la wishlist

Rôles
Plateforme
SUPER_ADMIN
ADMIN
USER
Event
ORGANIZER
CO_ORGANIZER
GUEST

Règles métier importantes

Contribution
❌ impossible si paiement en attente existe
❌ impossible si item déjà financé
Réservation
❌ impossible si contribution confirmée
❌ impossible si paiement en attente
Wishlist
créée automatiquement avec l’event

Format standard API

Toutes les réponses doivent suivre :

{
"success": true,
"message": "optional",
"data": { ... }
}

Erreur :

{
"success": false,
"message": "Unauthorized",
"statusCode": 401
}
