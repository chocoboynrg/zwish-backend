import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { EventParticipant } from './event-participant.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { ParticipantRole } from './enums/participant-role.enum';
import { ParticipantStatus } from './enums/participant-status.enum';

@Injectable()
export class ParticipantsService {
  constructor(
    @InjectRepository(EventParticipant)
    private readonly participantsRepository: Repository<EventParticipant>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async createParticipant(
    eventId: number,
    userId: number,
    role: ParticipantRole = ParticipantRole.GUEST,
    status: ParticipantStatus = ParticipantStatus.INVITED,
  ) {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const existing = await this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
      relations: ['event', 'user'],
    });

    if (existing) {
      throw new ConflictException(
        'Cet utilisateur participe déjà à cet événement',
      );
    }

    const joinedAt = status === ParticipantStatus.ACCEPTED ? new Date() : null;

    const participant = this.participantsRepository.create({
      event,
      user,
      role,
      status,
      joinedAt,
    });

    return this.participantsRepository.save(participant);
  }

  async findAll() {
    return this.participantsRepository.find({
      relations: ['event', 'user'],
      order: { id: 'DESC' },
    });
  }

  async findByEvent(eventId: number) {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    const participants = await this.participantsRepository.find({
      where: {
        event: { id: eventId },
      },
      relations: ['event', 'user'],
      order: { id: 'DESC' },
    });

    return {
      event: {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        description: event.description ?? null,
      },
      total: participants.length,
      participants: participants.map((participant) => ({
        id: participant.id,
        role: participant.role,
        status: participant.status,
        joinedAt: participant.joinedAt,
        user: {
          id: participant.user.id,
          name: participant.user.name,
          email: participant.user.email,
        },
      })),
    };
  }

  async findByUser(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const participations = await this.participantsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: ['event', 'user'],
      order: { id: 'DESC' },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      total: participations.length,
      participations: participations.map((participant) => ({
        id: participant.id,
        role: participant.role,
        status: participant.status,
        joinedAt: participant.joinedAt,
        event: {
          id: participant.event.id,
          title: participant.event.title,
          eventDate: participant.event.eventDate,
          description: participant.event.description ?? null,
        },
      })),
    };
  }

  async getParticipantsByEvent(eventId: number, actorUserId: number) {
    const canManage = await this.canManageEvent(actorUserId, eventId);

    if (!canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez pas consulter les participants de cet événement',
      );
    }

    const participants = await this.participantsRepository.find({
      where: {
        event: { id: eventId },
      },
      relations: ['event', 'user'],
      order: {
        id: 'DESC',
      },
    });

    return {
      items: participants.map((participant) => ({
        id: participant.id,
        role: participant.role,
        status: participant.status,
        joinedAt: participant.joinedAt,
        event: participant.event
          ? {
              id: participant.event.id,
              title: participant.event.title,
              eventDate: participant.event.eventDate,
            }
          : null,
        user: participant.user
          ? {
              id: participant.user.id,
              name: participant.user.name,
              email: participant.user.email,
            }
          : null,
      })),
      total: participants.length,
    };
  }

  async generateInviteLink(eventId: number, actorUserId: number) {
    const canManage = await this.canManageEvent(actorUserId, eventId);

    if (!canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez pas générer un lien pour cet événement',
      );
    }

    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    if (!event.shareToken || event.shareToken.trim().length === 0) {
      event.shareToken = randomBytes(24).toString('hex');
      await this.eventsRepository.save(event);
    }

    return {
      eventId: event.id,
      shareToken: event.shareToken,
      invitePath: `/join/${event.shareToken}`,
    };
  }

  async joinByShareToken(shareToken: string, userId: number) {
    const event = await this.eventsRepository.findOne({
      where: { shareToken },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Lien d’invitation invalide');
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const existingParticipant = await this.participantsRepository.findOne({
      where: {
        event: { id: event.id },
        user: { id: userId },
      },
      relations: ['event', 'user'],
    });

    if (existingParticipant) {
      if (existingParticipant.status !== ParticipantStatus.ACCEPTED) {
        existingParticipant.status = ParticipantStatus.ACCEPTED;
        existingParticipant.joinedAt = new Date();
        await this.participantsRepository.save(existingParticipant);
      }

      return {
        message: 'Vous participez déjà à cet événement',
        participant: {
          id: existingParticipant.id,
          role: existingParticipant.role,
          status: existingParticipant.status,
          joinedAt: existingParticipant.joinedAt,
          event: {
            id: event.id,
            title: event.title,
            eventDate: event.eventDate,
          },
        },
      };
    }

    // Si l’utilisateur est l’owner technique de l’événement mais qu’il n’existe
    // pas encore en participant, on l’inscrit comme ORGANIZER.
    const role =
      event.organizer?.id === userId
        ? ParticipantRole.ORGANIZER
        : ParticipantRole.GUEST;

    const participant = this.participantsRepository.create({
      event,
      user,
      role,
      status: ParticipantStatus.ACCEPTED,
      joinedAt: new Date(),
    });

    const saved = await this.participantsRepository.save(participant);

    const fullParticipant = await this.participantsRepository.findOne({
      where: { id: saved.id },
      relations: ['event', 'user'],
    });

    if (!fullParticipant) {
      throw new NotFoundException('Participant créé mais introuvable ensuite');
    }

    return {
      message: 'Participation enregistrée avec succès',
      participant: {
        id: fullParticipant.id,
        role: fullParticipant.role,
        status: fullParticipant.status,
        joinedAt: fullParticipant.joinedAt,
        event: {
          id: fullParticipant.event.id,
          title: fullParticipant.event.title,
          eventDate: fullParticipant.event.eventDate,
        },
        user: {
          id: fullParticipant.user.id,
          name: fullParticipant.user.name,
          email: fullParticipant.user.email,
        },
      },
    };
  }

  async previewByShareToken(shareToken: string) {
    const event = await this.eventsRepository.findOne({
      where: { shareToken },
      relations: ['organizer'],
    });

    if (!event) {
      throw new NotFoundException('Lien d’invitation invalide');
    }

    return {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        organizer: event.organizer
          ? {
              id: event.organizer.id,
              name: event.organizer.name,
            }
          : null,
      },
    };
  }

  async updateParticipantRole(
    participantId: number,
    role: ParticipantRole,
    actorUserId: number,
  ) {
    const participant = await this.participantsRepository.findOne({
      where: { id: participantId },
      relations: ['event', 'event.organizer', 'user'],
    });

    if (!participant) {
      throw new NotFoundException('Participant introuvable');
    }

    const event = participant.event;

    if (!event) {
      throw new NotFoundException('Événement introuvable');
    }

    const canManage = await this.canManageEvent(actorUserId, event.id);

    if (!canManage) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier les rôles de cet événement',
      );
    }

    if (participant.user?.id === actorUserId) {
      throw new BadRequestException(
        'Vous ne pouvez pas modifier votre propre rôle via cette action',
      );
    }

    if (role === ParticipantRole.ORGANIZER) {
      throw new BadRequestException(
        'Le rôle ORGANIZER ne peut pas être attribué ici',
      );
    }

    participant.role = role;
    await this.participantsRepository.save(participant);

    return {
      message: 'Rôle mis à jour avec succès',
      participant: {
        id: participant.id,
        role: participant.role,
        status: participant.status,
        joinedAt: participant.joinedAt,
        event: {
          id: event.id,
          title: event.title,
          eventDate: event.eventDate,
        },
        user: participant.user
          ? {
              id: participant.user.id,
              name: participant.user.name,
              email: participant.user.email,
            }
          : null,
      },
    };
  }

  async getUserRoleInEvent(userId: number, eventId: number) {
    return this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });
  }

  private async canManageEvent(
    userId: number,
    eventId: number,
  ): Promise<boolean> {
    const participant = await this.participantsRepository.findOne({
      where: {
        event: { id: eventId },
        user: { id: userId },
      },
    });

    if (!participant) {
      return false;
    }

    return (
      participant.status === ParticipantStatus.ACCEPTED &&
      (participant.role === ParticipantRole.ORGANIZER ||
        participant.role === ParticipantRole.CO_ORGANIZER)
    );
  }
}
