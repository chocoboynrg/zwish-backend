export class ItemResponseDto<T> {
  success!: true;
  message!: string;
  data!: {
    item: T;
  };

  constructor(item: T, message = 'Élément récupéré avec succès') {
    this.success = true;
    this.message = message;
    this.data = {
      item,
    };
  }
}
