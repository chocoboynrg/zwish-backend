import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPaymentSucceededDto {
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
  note?: string;
}
