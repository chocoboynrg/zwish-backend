import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsCleanupService {
  private readonly logger = new Logger(PaymentsCleanupService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStalePayments() {
    try {
      const result = await this.paymentsService.expirePendingPayments();

      if (result.expired > 0) {
        this.logger.warn(
          `Expired payments automatically | expired=${result.expired} scanned=${result.scanned}`,
        );
      } else {
        this.logger.log(
          `No expired payments found | scanned=${result.scanned}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Payments cleanup failed | error=${error instanceof Error ? error.message : 'unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
