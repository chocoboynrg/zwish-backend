import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NotificationChannel } from '../enums/notification-channel.enum';

export class CreateNotificationDto {
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsNumber()
  eventId?: number;

  @IsString()
  @MaxLength(100)
  type: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  dataPayload?: Record<string, any>;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}
