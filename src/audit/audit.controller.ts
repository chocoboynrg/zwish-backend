import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlatformRole } from '../users/enums/platform-role.enum';
import {
  buildItemResponse,
  buildListResponse,
} from '../common/api/api-response.types';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/logs')
  async getAdminLogs(@Query() query: AuditLogsQueryDto) {
    const { items, total, summary } =
      await this.auditService.getAdminLogs(query);

    return buildListResponse(items, total, summary, 'Audit logs chargés');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/logs/:id')
  async getAdminLogById(@Param('id', ParseIntPipe) id: number) {
    const item = await this.auditService.getAdminLogById(id);

    return buildItemResponse(item, 'Audit log chargé');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/export')
  async exportAdminLogsCsv(
    @Query() query: AuditLogsQueryDto,
    @CurrentUser() actor: JwtUser,
    @Res() res: Response,
  ) {
    const csv = await this.auditService.exportAdminLogsCsv(query);

    const filename = `audit-logs-export-${new Date().toISOString().slice(0, 10)}.csv`;

    await this.auditService.logAdminAuditExport(actor, query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csv);
  }
}
