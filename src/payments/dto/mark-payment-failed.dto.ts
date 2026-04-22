import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPaymentFailedDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  failureReason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
