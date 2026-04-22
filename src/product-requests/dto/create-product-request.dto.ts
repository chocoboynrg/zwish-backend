import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductRequestDto {
  @IsNumber()
  wishlistId: number;

  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @IsString()
  @MaxLength(180)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencyCode?: string;
}
