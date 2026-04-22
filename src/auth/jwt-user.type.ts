import { PlatformRole } from '../users/enums/platform-role.enum';

export type JwtUser = {
  userId: number;
  email: string;
  name: string;
  platformRole: PlatformRole;
};
