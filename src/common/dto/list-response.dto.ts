export class ListResponseDto<T> {
  success!: true;
  message!: string;
  data!: {
    items: T[];
    total: number;
    summary?: Record<string, unknown>;
  };

  constructor(
    items: T[],
    total?: number,
    summary?: Record<string, unknown>,
    message = 'Liste récupérée avec succès',
  ) {
    this.success = true;
    this.message = message;
    this.data = {
      items,
      total: total ?? items.length,
      ...(summary ? { summary } : {}),
    };
  }
}
