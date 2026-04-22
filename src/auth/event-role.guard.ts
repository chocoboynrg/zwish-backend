import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EVENT_ROLES_KEY } from './event-roles.decorator';
import { JwtUser } from './jwt-user.type';
import { EventParticipant } from '../participants/event-participant.entity';
import { ParticipantRole } from '../participants/enums/participant-role.enum';
import { ParticipantStatus } from '../participants/enums/participant-status.enum';
import { Event } from '../events/event.entity';
import { Wishlist } from '../wishlists/wishlist.entity';

@Injectable()
export class EventRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    @InjectRepository(EventParticipant)
    private readonly participantsRepository: Repository<EventParticipant>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(Wishlist)
    private readonly wishlistRepository: Repository<Wishlist>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ParticipantRole[]>(
      EVENT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
      params?: Record<string, string>;
      body?: any;
    }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    let eventId: number | null = null;

    // ✅ 1. Cas classique : param URL
    const rawEventId = request.params?.eventId ?? request.params?.id;

    if (rawEventId) {
      const parsed = Number(rawEventId);
      if (!Number.isNaN(parsed) && parsed > 0) {
        eventId = parsed;
      }
    }

    // ✅ 2. Cas wishlist → récupérer event via wishlistId
    if (!eventId && request.body?.wishlistId) {
      const wishlistId = Number(request.body.wishlistId);

      if (!Number.isNaN(wishlistId) && wishlistId > 0) {
        const wishlist = await this.wishlistRepository.findOne({
          where: { id: wishlistId },
          relations: ['event'],
        });

        if (!wishlist) {
          throw new NotFoundException('Wishlist introuvable');
        }

        eventId = wishlist.event?.id ?? null;
      }
    }

    if (!eventId) {
      throw new ForbiddenException(
        "Impossible de déterminer l'événement ciblé pour le contrôle d'accès",
      );
    }

    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    // owner technique = organizer
    if (
      event.organizer?.id === user.userId &&
      requiredRoles.includes(ParticipantRole.ORGANIZER)
    ) {
      return true;
    }

    const participant = await this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: user.userId },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Vous ne participez pas à cet événement');
    }

    if (participant.status !== ParticipantStatus.ACCEPTED) {
      throw new ForbiddenException(
        "Votre participation n'est pas active pour cet événement",
      );
    }

    if (!requiredRoles.includes(participant.role)) {
      throw new ForbiddenException('Accès refusé pour ce rôle événementiel');
    }

    return true;
  }
}
