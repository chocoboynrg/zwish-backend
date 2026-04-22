export class ActionResponseDto<T = unknown> {
  success!: true;
  message!: string;
  data!: {
    item?: T;
    updatedCount?: number;
  };

  constructor(message: string, item?: T, updatedCount?: number) {
    this.success = true;
    this.message = message;
    this.data = {
      ...(item !== undefined ? { item } : {}),
      ...(updatedCount !== undefined ? { updatedCount } : {}),
    };
  }
}
