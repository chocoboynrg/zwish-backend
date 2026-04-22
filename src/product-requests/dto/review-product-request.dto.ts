import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProductRequestStatus } from '../enums/product-request-status.enum';

export class ReviewProductRequestDto {
  @IsEnum(ProductRequestStatus)
  status: ProductRequestStatus;

  @IsOptional()
  @IsString()
  reviewComment?: string;

  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @IsOptional()
  @IsNumber()
  approvedCatalogProductId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  approvedProductName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  approvedProductSlug?: string;
}
