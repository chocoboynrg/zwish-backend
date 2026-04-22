import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateContributionDto {
  @IsInt()
  @Min(1)
  wishlistItemId: number;

  @IsInt()
  @Min(1)
  contributorUserId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @Length(3, 10)
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  message?: string;
}
