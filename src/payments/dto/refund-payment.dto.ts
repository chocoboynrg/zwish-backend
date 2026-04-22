import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefundPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
