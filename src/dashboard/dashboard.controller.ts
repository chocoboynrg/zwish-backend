import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { buildSuccessResponse } from '../common/api/api-response.types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PlatformRole } from '../users/enums/platform-role.enum';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyDashboard(@CurrentUser() user: JwtUser) {
    const data = await this.dashboardService.getMyDashboard(user.userId);

    return buildSuccessResponse(data, 'Tableau de bord utilisateur chargé');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin')
  async getAdminDashboard() {
    const data = await this.dashboardService.getAdminDashboard();

    return buildSuccessResponse(data, 'Tableau de bord administrateur chargé');
  }
}
