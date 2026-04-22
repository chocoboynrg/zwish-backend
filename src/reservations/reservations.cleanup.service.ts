import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReservationsService } from './reservations.service';

@Injectable()
export class ReservationsCleanupService {
  private readonly logger = new Logger(ReservationsCleanupService.name);

  constructor(private readonly reservationsService: ReservationsService) {}

  @Cron('*/1 * * * *') // chaque minute
  async handleCleanup() {
    const result = await this.reservationsService.cleanupExpiredReservations();

    if (result.processed > 0) {
      this.logger.log(`Expired reservations cleaned: ${result.processed}`);
    }
  }
}
