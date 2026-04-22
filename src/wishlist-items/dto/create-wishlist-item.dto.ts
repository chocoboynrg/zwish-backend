import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWishlistItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsInt()
  @Min(1)
  wishlistId: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}