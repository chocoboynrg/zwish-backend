# Catalog Module

## Rôle du module

Le module `catalog` gère le catalogue de produits et de catégories disponibles dans la plateforme.

Il permet de :

- créer et gérer des catégories de produits
- créer et gérer des produits catalogue
- rechercher des produits
- filtrer par statut
- uploader des images produits

Ce module sert de base pour permettre aux utilisateurs de sélectionner des produits lors de la création d’items de wishlist.

---

## Position dans l’architecture

Le module `catalog` est **indépendant du core métier** mais utilisé par :

- `wishlist-items` (future intégration)
- UX frontend (sélection produit)
- admin/backoffice

Il représente une **source de données produits standardisée**.

---

## Structure du module

- `catalog.module.ts`
- `catalog.controller.ts`
- `catalog.service.ts`
- `catalog-category.entity.ts`
- `catalog-product.entity.ts`
- DTOs :
  - `create-category.dto.ts`
  - `update-category.dto.ts`
  - `create-product.dto.ts`
  - `update-product.dto.ts`
- Enum :
  - `catalog-product-status.enum.ts`

---

## Entité : `CatalogCategory`

Table : `catalog_categories` :contentReference[oaicite:0]{index=0}

### Champs

- `id`
- `name` (unique)
- `slug` (unique)
- `description`
- `isActive`
- `createdAt`
- `updatedAt`

### Relations

- `products` (1 → N)

---

## Entité : `CatalogProduct`

Table : `catalog_products` :contentReference[oaicite:1]{index=1}

### Champs

- `id`
- `category`
- `name`
- `slug` (unique)
- `description`
- `mainImageUrl`
- `referenceUrl`
- `brand`
- `estimatedPrice`
- `currencyCode`
- `status`
- `createdAt`
- `updatedAt`

---

## Enum : `CatalogProductStatus`

```ts
DRAFT
ACTIVE
INACTIVE
ARCHIVED

DTOs
CreateCategoryDto
{
  "name": "Électronique",
  "slug": "electronique",
  "description": "Produits électroniques",
  "isActive": true
}

CreateProductDto
{
  "categoryId": 1,
  "name": "TV Samsung",
  "slug": "tv-samsung",
  "description": "Smart TV",
  "mainImageUrl": "...",
  "referenceUrl": "...",
  "brand": "Samsung",
  "estimatedPrice": 250000,
  "currencyCode": "XOF",
  "status": "ACTIVE"
}

Update DTOs

Basés sur PartialType → tous les champs optionnels.

Controller : CatalogController

Routes exposées :

Catégories
POST /catalog/categories
GET /catalog/categories
GET /catalog/categories/:id
PATCH /catalog/categories/:id
DELETE /catalog/categories/:id
Produits
POST /catalog/products
GET /catalog/products
GET /catalog/products/:id
PATCH /catalog/products/:id
DELETE /catalog/products/:id
Upload
POST /catalog/upload
Endpoints clés
POST /catalog/categories

Crée une catégorie.

Règles
name unique
slug unique
GET /catalog/categories

Retourne toutes les catégories.

PATCH /catalog/categories/:id

Met à jour une catégorie avec validation d’unicité.

DELETE /catalog/categories/:id

Supprime une catégorie.

POST /catalog/products

Crée un produit.

Règles métier
catégorie doit exister
name unique
slug unique
GET /catalog/products

Recherche + filtre.

Paramètres
search
status
Recherche

Utilise :

ILike('%search%')

sur :

name
slug
brand
PATCH /catalog/products/:id

Met à jour un produit.

Vérifications
unicité name
unicité slug
validité catégorie
DELETE /catalog/products/:id

Supprime un produit.

POST /catalog/upload

Upload image produit.

Stockage
dossier : ./uploads/products
nom généré :
product-{timestamp-random}.{ext}
Réponse
{
  "success": true,
  "url": "/uploads/products/xxx.jpg"
}
Service : CatalogService

createCategory(dto)
vérifie unicité name + slug
crée catégorie
findAllCategories()
tri DESC
updateCategory(id, dto)
validation unicité
update partiel
removeCategory(id)
suppression directe
createProduct(dto)

🔥 Fonction principale

Étapes
vérifier catégorie
vérifier unicité name + slug
créer produit
Valeurs par défaut
currencyCode = 'XOF'
status = ACTIVE
estimatedPrice = 0
findAllProducts(search, status)
Cas 1 : search
recherche LIKE sur :
name
slug
brand
Cas 2 : filtre
status
updateProduct(id, dto)
validation catégorie
validation unicité
update champ par champ
removeProduct(id)
suppression simple
Règles métier implémentées
1. Unicité forte
category : name + slug
product : name + slug
2. Catégorie obligatoire

Un produit doit appartenir à une catégorie.

3. Statut produit

Permet de contrôler visibilité :

ACTIVE → visible
INACTIVE → masqué
ARCHIVED → supprimé logique
4. Recherche flexible

Recherche sur plusieurs champs via ILIKE.

5. Upload image intégré

Gestion locale des fichiers produits.

Points forts

✅ CRUD complet
✅ validation robuste
✅ recherche performante
✅ structure claire
✅ extensible

Limites actuelles
pas de pagination
pas de soft delete
pas de multi-images
pas de gestion stock
pas de prix dynamique
pas de relation directe avec wishlist-items
Évolutions possibles
liaison directe produit → wishlist-item
catégories hiérarchiques
multi-images
tags
stock / disponibilité
favoris utilisateur
recommandations
Résumé

Le module catalog fournit une base produit structurée.

Il gère :

les catégories
les produits
la recherche
les statuts
les images

Il prépare l’intégration future avec la création d’items wishlist basés sur catalogue.
```
