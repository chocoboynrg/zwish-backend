import {
  buildActionResponse as buildActionResponseCore,
  buildItemResponse as buildItemResponseCore,
  buildListResponse as buildListResponseCore,
  type ActionPayload,
  type ApiSuccessResponse,
  type ItemPayload,
  type ListPayload,
} from '../api/api-response.types';

export function buildListResponse<T>(
  items: T[],
  total?: number,
  summary?: Record<string, unknown>,
  message = 'Liste récupérée avec succès',
): ApiSuccessResponse<ListPayload<T>> {
  return buildListResponseCore(items, total, summary, message);
}

export function buildItemResponse<T>(
  item: T,
  message = 'Élément récupéré avec succès',
): ApiSuccessResponse<ItemPayload<T>> {
  return buildItemResponseCore(item, message);
}

export function buildActionResponse<T = unknown>(
  item?: T,
  message = 'Opération effectuée avec succès',
  updatedCount?: number,
): ApiSuccessResponse<ActionPayload<T>> {
  return buildActionResponseCore(item, message, updatedCount);
}
