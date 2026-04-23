import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MarkPaymentSucceededDto } from './dto/mark-payment-succeeded.dto';
import { MarkPaymentFailedDto } from './dto/mark-payment-failed.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import {
  buildItemResponse,
  buildListResponse,
  buildSuccessResponse,
} from '../common/api/api-response.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlatformRole } from '../users/enums/platform-role.enum';
import { PaymentWebhookGuard } from './payment-webhook.guard';
import { Throttle } from '@nestjs/throttler';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { AdminPaymentsQueryDto } from './dto/admin-payments-query.dto';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentWebhookEventsQueryDto } from './dto/payment-webhook-events-query.dto';
import type { Response } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: CreatePaymentDto, @CurrentUser() user: JwtUser) {
    const item = await this.paymentsService.create({
      ...body,
      payerUserId: user.userId,
    });

    return buildSuccessResponse({ item }, 'Paiement initialisé');
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAccessible(
    @CurrentUser() user: JwtUser,
    @Query() query: PaymentsQueryDto,
  ) {
    const { items, total } = await this.paymentsService.findAccessiblePaginated(
      user.userId,
      query,
    );

    return buildListResponse(items, total);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyPayments(
    @CurrentUser() user: JwtUser,
    @Query() query: PaymentsQueryDto,
  ) {
    const { items, total, summary } =
      await this.paymentsService.getMyPaymentsPaginated(user.userId, query);

    return buildListResponse(items, total, summary, 'Mes paiements chargés');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    const item = await this.paymentsService.findOneAccessible(id, user.userId);

    return buildSuccessResponse({ item }, 'Paiement chargé');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch(':id/succeed')
  async markAsSucceeded(
    @Param('id', ParseIntPipe) id: number,
    @Body() markPaymentSucceededDto: MarkPaymentSucceededDto,
  ) {
    const item = await this.paymentsService.markAsSucceeded(
      id,
      markPaymentSucceededDto,
    );

    return buildSuccessResponse({ item }, 'Paiement marqué comme réussi');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch(':id/fail')
  async markAsFailed(
    @Param('id', ParseIntPipe) id: number,
    @Body() markPaymentFailedDto: MarkPaymentFailedDto,
  ) {
    const item = await this.paymentsService.markAsFailed(
      id,
      markPaymentFailedDto,
    );

    return buildSuccessResponse({ item }, 'Paiement marqué comme échoué');
  }

  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } }) // max 20 requêtes/minute
  @UseGuards(PaymentWebhookGuard)
  @Post('webhook')
  async handleWebhook(@Body() webhookDto: PaymentWebhookDto) {
    const data = await this.paymentsService.handleWebhook(webhookDto);

    return buildSuccessResponse(data, 'Webhook paiement traité');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/all')
  async getAdminPayments(@Query() query: AdminPaymentsQueryDto) {
    const { items, total, summary } =
      await this.paymentsService.getAdminPayments(query);

    return buildListResponse(
      items,
      total,
      summary,
      'Paiements administrateur chargés',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/export')
  async exportAdminPaymentsCsv(
    @Query() query: AdminPaymentsQueryDto,
    @CurrentUser() actor: JwtUser,
    @Res() res: Response,
  ) {
    const csv = await this.paymentsService.exportAdminPaymentsCsv(query);

    const filename = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;

    await this.paymentsService.logAdminPaymentsExport(actor, query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/reconciliation')
  async getReconciliationReport(@Query() query: ReconciliationQueryDto) {
    const { items, total, summary } =
      await this.paymentsService.getReconciliationReport(query);

    return buildListResponse(
      items,
      total,
      summary,
      'Rapport de réconciliation chargé',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/:id')
  async getAdminPaymentById(@Param('id', ParseIntPipe) id: number) {
    const item = await this.paymentsService.getAdminPaymentById(id);

    return buildItemResponse(item, 'Détail paiement administrateur chargé');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/:id/reconciliation')
  async getPaymentReconciliationDetail(@Param('id', ParseIntPipe) id: number) {
    const item = await this.paymentsService.getPaymentReconciliationDetail(id);

    return buildItemResponse(item, 'Détail de réconciliation chargé');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch(':id/refund')
  async refundPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() refundPaymentDto: RefundPaymentDto,
  ) {
    const item = await this.paymentsService.refundPayment(id, refundPaymentDto);

    return buildSuccessResponse({ item }, 'Paiement remboursé avec succès');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/:id/webhooks')
  async getPaymentWebhookEvents(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaymentWebhookEventsQueryDto,
  ) {
    const { items, total, summary } =
      await this.paymentsService.getPaymentWebhookEvents(id, query);

    return buildListResponse(
      items,
      total,
      summary,
      'Événements webhook du paiement chargés',
    );
  }
}
