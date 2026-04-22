export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: unknown;
  statusCode: number;
  path: string;
  timestamp: string;
}

export interface ListPayload<T> {
  items: T[];
  total: number;
  summary?: Record<string, unknown>;
}

export interface ItemPayload<T> {
  item: T;
}

export interface ActionPayload<T = unknown> {
  item?: T;
  updatedCount?: number;
}

export function buildSuccessResponse<T>(
  data: T,
  message = 'Opération réussie',
): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

export function buildListResponse<T>(
  items: T[],
  total = items.length,
  summary?: Record<string, unknown>,
  message = 'Liste récupérée avec succès',
): ApiSuccessResponse<ListPayload<T>> {
  return buildSuccessResponse(
    {
      items,
      total,
      ...(summary ? { summary } : {}),
    },
    message,
  );
}

export function buildItemResponse<T>(
  item: T,
  message = 'Élément récupéré avec succès',
): ApiSuccessResponse<ItemPayload<T>> {
  return buildSuccessResponse(
    {
      item,
    },
    message,
  );
}

export function buildActionResponse<T = unknown>(
  item?: T,
  message = 'Opération effectuée avec succès',
  updatedCount?: number,
): ApiSuccessResponse<ActionPayload<T>> {
  return buildSuccessResponse(
    {
      ...(item !== undefined ? { item } : {}),
      ...(updatedCount !== undefined ? { updatedCount } : {}),
    },
    message,
  );
}
