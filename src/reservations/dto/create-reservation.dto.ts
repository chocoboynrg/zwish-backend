import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateReservationDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  wishlistItemId: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  eventId: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  reservedByUserId: number;

  @IsOptional()
  @IsString()
  releaseReason?: string;
}
