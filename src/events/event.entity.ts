import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Reservation } from '../reservations/reservation.entity';
import { Contribution } from '../contributions/contribution.entity';
import { EventParticipant } from '../participants/event-participant.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  title: string;

  @Column({ type: 'timestamp' })
  eventDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  shareToken: string | null;

  // Owner technique de l’événement
  @ManyToOne(() => User, { eager: true, nullable: false })
  organizer: User;

  @OneToMany(() => Reservation, (reservation) => reservation.event)
  reservations: Reservation[];

  @OneToMany(() => Contribution, (contribution) => contribution.event)
  contributions: Contribution[];

  @OneToMany(() => EventParticipant, (participant) => participant.event)
  participants: EventParticipant[];
}
