import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ParticipantRole } from '../enums/participant-role.enum';
import { ParticipantStatus } from '../enums/participant-status.enum';

export class CreateParticipantDto {
  @IsInt()
  @Min(1)
  eventId: number;

  @IsInt()
  @Min(1)
  userId: number;

  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;

  @IsOptional()
  @IsEnum(ParticipantStatus)
  status?: ParticipantStatus;
}
