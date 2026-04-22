import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  @MaxLength(50)
  provider: string;

  @IsInt()
  @Min(1)
  paymentId: number;

  @IsIn(['SUCCEEDED', 'FAILED'])
  status: 'SUCCEEDED' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerTransactionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  failureReason?: string;

  @IsOptional()
  @IsObject()
  rawPayload?: unknown;
}
