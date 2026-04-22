import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CatalogProductStatus } from '../enums/catalog-product-status.enum';

export class CreateProductDto {
  @IsNumber()
  categoryId: number;

  @IsString()
  @MaxLength(180)
  name: string;

  @IsString()
  @MaxLength(220)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mainImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;

  @IsOptional()
  @IsEnum(CatalogProductStatus)
  status?: CatalogProductStatus;
}
