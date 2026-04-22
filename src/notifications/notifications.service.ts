import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationChannel } from './enums/notification-channel.enum';
import { NotificationStatus } from './enums/notification-status.enum';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  async create(dto: CreateNotificationDto) {
    const user = await this.usersRepository.findOne({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    let event: Event | null = null;

    if (dto.eventId !== undefined) {
      event = await this.eventsRepository.findOne({
        where: { id: dto.eventId },
      });

      if (!event) {
        throw new NotFoundException('Événement introuvable');
      }
    }

    const notification = this.notificationsRepository.create({
      user,
      event,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      dataPayload: dto.dataPayload ? JSON.stringify(dto.dataPayload) : null,
      channel: dto.channel ?? NotificationChannel.IN_APP,
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      readAt: null,
    });

    return this.notificationsRepository.save(notification);
  }

  async findMyNotifications(userId: number) {
    const notifications = await this.notificationsRepository.find({
      where: {
        user: { id: userId },
      },
      order: { id: 'DESC' },
    });

    return notifications.map((notification) => ({
      ...notification,
      dataPayload: notification.dataPayload
        ? JSON.parse(notification.dataPayload)
        : null,
    }));
  }

  async findOneAccessible(id: number, userId: number) {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    if (notification.user.id !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas consulter cette notification',
      );
    }

    return {
      ...notification,
      dataPayload: notification.dataPayload
        ? JSON.parse(notification.dataPayload)
        : null,
    };
  }

  async markAsRead(id: number, userId: number) {
    const notification = await this.notificationsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    if (notification.user.id !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier cette notification',
      );
    }

    if (notification.status === NotificationStatus.READ) {
      return {
        ...notification,
        dataPayload: notification.dataPayload
          ? JSON.parse(notification.dataPayload)
          : null,
      };
    }

    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();

    const saved = await this.notificationsRepository.save(notification);

    return {
      ...saved,
      dataPayload: saved.dataPayload ? JSON.parse(saved.dataPayload) : null,
    };
  }

  async markAllAsRead(userId: number) {
    const notifications = await this.notificationsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: ['user'],
    });

    const unread = notifications.filter(
      (notification) => notification.status !== NotificationStatus.READ,
    );

    for (const notification of unread) {
      notification.status = NotificationStatus.READ;
      notification.readAt = new Date();
    }

    await this.notificationsRepository.save(unread);

    return {
      updatedCount: unread.length,
    };
  }

  async countUnread(userId: number) {
    const unreadCount = await this.notificationsRepository.count({
      where: {
        user: { id: userId },
        status: NotificationStatus.SENT,
      },
    });

    return {
      userId,
      unreadCount,
    };
  }
}
