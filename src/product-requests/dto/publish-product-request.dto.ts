import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PublishProductRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;
}
