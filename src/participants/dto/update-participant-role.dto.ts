import { IsEnum } from 'class-validator';
import { ParticipantRole } from '../enums/participant-role.enum';

export class UpdateParticipantRoleDto {
  @IsEnum(ParticipantRole)
  role: ParticipantRole;
}
