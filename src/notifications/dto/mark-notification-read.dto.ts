import { IsOptional, IsString } from 'class-validator';

export class MarkNotificationReadDto {
  @IsOptional()
  @IsString()
  note?: string;
}
