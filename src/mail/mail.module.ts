import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule implements OnModuleInit {
  private readonly logger = new Logger(MailModule.name);

  constructor(private readonly mailService: MailService) {}

  async onModuleInit() {
    try {
      await this.mailService.verifyTransport();
    } catch (error) {
      this.logger.error(
        `SMTP verification failed | error=${error instanceof Error ? error.message : 'unknown'}`,
      );

      if (error instanceof Error && error.stack) {
        this.logger.error(error.stack);
      }
    }
  }
}
