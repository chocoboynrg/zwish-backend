import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import type { Response } from 'express';
import { buildSuccessResponse } from '../common/api/api-response.types';
import { UpdateProfileDto } from './dto/update-profil.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { PlatformRole } from './enums/platform-role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAllUsers() {
    const items = await this.usersService.getAllUsers();

    return buildSuccessResponse(
      {
        items,
        total: items.length,
      },
      'Utilisateurs récupérés avec succès',
    );
  }

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    const item = await this.usersService.createUser(body.name, body.email);

    return buildSuccessResponse({ item }, 'Utilisateur créé avec succès');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getMyProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtUser,
  ) {
    if (id !== user.userId) {
      throw new ForbiddenException('Accès interdit à ce profil');
    }

    const item = await this.usersService.findSafeById(id);

    return buildSuccessResponse({ item }, 'Profil récupéré');
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  async updateMyProfile(
    @CurrentUser() user: JwtUser,
    @Body() body: UpdateProfileDto,
  ) {
    const item = await this.usersService.updateProfile(user.userId, body);

    return buildSuccessResponse({ item }, 'Profil mis à jour');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/all')
  async getAdminUsers(@Query() query: AdminUsersQueryDto) {
    const { items, total, summary } =
      await this.usersService.getAdminUsers(query);

    return buildSuccessResponse(
      { items, total, summary },
      'Utilisateurs admin chargés',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/:id')
  async getAdminUserById(@Param('id', ParseIntPipe) id: number) {
    const item = await this.usersService.getAdminUserById(id);

    return buildSuccessResponse({ item }, 'Utilisateur chargé');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch('admin/:id/suspend')
  async suspendUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: JwtUser,
    @Body() body: SuspendUserDto,
  ) {
    const item = await this.usersService.suspendUser(
      id,
      {
        userId: actor.userId,
        platformRole: actor.platformRole,
      },
      body.reason,
    );

    return buildSuccessResponse({ item }, 'Utilisateur suspendu avec succès');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Patch('admin/:id/unsuspend')
  async unsuspendUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: JwtUser,
  ) {
    const item = await this.usersService.unsuspendUser(id, {
      userId: actor.userId,
      platformRole: actor.platformRole,
    });

    return buildSuccessResponse({ item }, 'Utilisateur réactivé avec succès');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.SUPER_ADMIN)
  @Patch('admin/:id/role')
  async updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: JwtUser,
    @Body() body: UpdateUserRoleDto,
  ) {
    const item = await this.usersService.updateUserRole(
      id,
      {
        userId: actor.userId,
        platformRole: actor.platformRole,
      },
      body.role,
    );

    return buildSuccessResponse({ item }, 'Rôle utilisateur mis à jour');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.ADMIN, PlatformRole.SUPER_ADMIN)
  @Get('admin/export')
  async exportAdminUsersCsv(
    @Query() query: AdminUsersQueryDto,
    @CurrentUser() actor: JwtUser,
    @Res() res: Response,
  ) {
    const csv = await this.usersService.exportAdminUsersCsv(query);

    const filename = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;

    await this.usersService.logAdminUsersExport(actor, query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csv);
  }
}
