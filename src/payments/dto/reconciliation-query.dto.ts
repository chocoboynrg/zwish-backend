import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReconciliationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsEnum(['high', 'medium', 'low'])
  severity?: 'high' | 'medium' | 'low';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  contributionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId?: number;
}
