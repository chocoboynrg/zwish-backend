import { SetMetadata } from '@nestjs/common';
import { ParticipantRole } from '../participants/enums/participant-role.enum';

export const EVENT_ROLES_KEY = 'event_roles';

export const EventRoles = (...roles: ParticipantRole[]) =>
  SetMetadata(EVENT_ROLES_KEY, roles);
