import { IsEnum } from 'class-validator';
import { PlatformRole } from '../enums/platform-role.enum';

export class UpdateUserRoleDto {
  @IsEnum(PlatformRole)
  role: PlatformRole;
}
