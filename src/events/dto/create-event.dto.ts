import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
