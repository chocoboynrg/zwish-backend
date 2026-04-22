import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { ParticipantRole } from './enums/participant-role.enum';
import { ParticipantStatus } from './enums/participant-status.enum';

@Entity('event_participants')
@Unique(['event', 'user'])
export class EventParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Event, (event) => event.participants, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.GUEST,
  })
  role: ParticipantRole;

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.INVITED,
  })
  status: ParticipantStatus;

  @Column({ type: 'timestamp', nullable: true })
  joinedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
