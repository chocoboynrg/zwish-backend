import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class PaymentWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const expectedSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    if (!expectedSecret || expectedSecret.trim().length === 0) {
      throw new ForbiddenException('Webhook secret non configuré');
    }

    const rawHeader = request.headers?.['x-webhook-secret'];
    const providedSecret = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new ForbiddenException('Webhook non autorisé');
    }

    return true;
  }
}
