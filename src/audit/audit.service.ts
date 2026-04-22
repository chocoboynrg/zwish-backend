import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(params: {
    userId?: number;
    action: string;
    entityType?: string;
    entityId?: number;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      const payload: DeepPartial<AuditLog> = {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      };

      const log = this.repo.create(payload);
      await this.repo.save(log);
    } catch (error) {
      this.logger.error(
        `Audit log failed | action=${params.action} error=${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }

  async getAdminLogs(query: AuditLogsQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'DESC',
      action,
      entityType,
      entityId,
      userId,
      from,
      to,
      search,
    } = query;

    const allowedSortFields = new Set([
      'createdAt',
      'action',
      'entityType',
      'entityId',
      'userId',
    ]);

    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.repo.createQueryBuilder('audit');

    if (action) {
      qb.andWhere('audit.action = :action', { action });
    }

    if (entityType) {
      qb.andWhere('audit.entityType = :entityType', { entityType });
    }

    if (entityId) {
      qb.andWhere('audit.entityId = :entityId', { entityId });
    }

    if (userId) {
      qb.andWhere('audit.userId = :userId', { userId });
    }

    if (from) {
      qb.andWhere('audit.createdAt >= :from', { from });
    }

    if (to) {
      qb.andWhere('audit.createdAt <= :to', { to });
    }

    if (search) {
      qb.andWhere(
        `(audit.action ILIKE :search 
      OR audit.entityType ILIKE :search 
      OR audit.metadata::text ILIKE :search)`,
        { search: `%${search}%` },
      );
    }

    qb.orderBy(`audit.${safeSortBy}`, safeOrder as 'ASC' | 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [logs, total] = await qb.getManyAndCount();

    return {
      items: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        ip: log.ip,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      total,
      summary: {
        page,
        limit,
        totalCount: total,
      },
    };
  }
  async getAdminLogById(id: number) {
    const log = await this.repo.findOne({
      where: { id },
    });

    if (!log) {
      throw new NotFoundException('Audit log introuvable');
    }

    return {
      id: log.id,
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      ip: log.ip,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }

  async exportAdminLogsCsv(query: AuditLogsQueryDto) {
    const {
      sortBy = 'createdAt',
      order = 'DESC',
      action,
      entityType,
      entityId,
      userId,
      from,
      to,
      search,
    } = query;

    const allowedSortFields = new Set([
      'createdAt',
      'action',
      'entityType',
      'entityId',
      'userId',
    ]);

    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.repo.createQueryBuilder('audit');

    if (action) {
      qb.andWhere('audit.action = :action', { action });
    }

    if (entityType) {
      qb.andWhere('audit.entityType = :entityType', { entityType });
    }

    if (entityId) {
      qb.andWhere('audit.entityId = :entityId', { entityId });
    }

    if (userId) {
      qb.andWhere('audit.userId = :userId', { userId });
    }

    if (from) {
      qb.andWhere('audit.createdAt >= :from', { from });
    }

    if (to) {
      qb.andWhere('audit.createdAt <= :to', { to });
    }

    if (search) {
      qb.andWhere(
        `(audit.action ILIKE :search
        OR audit.entityType ILIKE :search
        OR audit.metadata::text ILIKE :search)`,
        { search: `%${search}%` },
      );
    }

    qb.orderBy(`audit.${safeSortBy}`, safeOrder as 'ASC' | 'DESC');

    const logs = await qb.getMany();

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) {
        return '';
      }

      return `"${String(value).replace(/"/g, '""')}"`;
    };

    const headers = [
      'id',
      'userId',
      'action',
      'entityType',
      'entityId',
      'metadata',
      'ip',
      'userAgent',
      'createdAt',
    ];

    const rows = logs.map((log) =>
      [
        log.id,
        log.userId,
        log.action,
        log.entityType,
        log.entityId,
        log.metadata ? JSON.stringify(log.metadata) : '',
        log.ip,
        log.userAgent,
        log.createdAt?.toISOString() ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  async logAdminAuditExport(
    actor: { userId: number; platformRole: string },
    query: AuditLogsQueryDto,
  ) {
    await this.log({
      userId: actor.userId,
      action: 'AUDIT_LOGS_EXPORTED',
      entityType: 'AuditLog',
      metadata: {
        actorRole: actor.platformRole,
        filters: query,
      },
    });
  }
}
