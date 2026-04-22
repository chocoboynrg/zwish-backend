import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyTestAppSetup } from './test-helpers';
import { UsersService } from '../src/users/users.service';
import { PaymentsService } from '../src/payments/payments.service';
import { ReservationsService } from '../src/reservations/reservations.service';
import { PlatformRole } from '../src/users/enums/platform-role.enum';

function unwrapData(body: any) {
  return body?.data ?? body;
}

function unwrapItem(body: any) {
  const data = unwrapData(body);
  return data?.item ?? data;
}

function unwrapItems(body: any) {
  const data = unwrapData(body);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

describe('Wishlist Backend E2E', () => {
  let app: INestApplication;

  let usersService: UsersService;
  let paymentsService: PaymentsService;
  let reservationsService: ReservationsService;

  let accessToken: string;
  let userId: number;
  let eventId: number;
  let wishlistId: number | null = null;
  let wishlistItemId: number;
  let contributionId: number;
  let paymentId: number;

  let adminToken: string;
  let adminUserId: number;
  let superAdminToken: string;
  let superAdminUserId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_WEBHOOK_SECRET =
      process.env.PAYMENT_WEBHOOK_SECRET || 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyTestAppSetup(app);
    await app.init();

    usersService = app.get(UsersService);
    paymentsService = app.get(PaymentsService);
    reservationsService = app.get(ReservationsService);

    const admin = await createPrivilegedUser(PlatformRole.ADMIN);
    adminToken = admin.token;
    adminUserId = admin.userId;

    const superAdmin = await createPrivilegedUser(PlatformRole.SUPER_ADMIN);
    superAdminToken = superAdmin.token;
    superAdminUserId = superAdmin.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  async function makeUserEventReady(id: number, phone = '+22670000000') {
    const user = await usersService.findByIdWithVerificationFields(id);
    user.emailVerifiedAt = new Date();
    user.phoneNumber = phone;
    await usersService.save(user);
  }

  async function createPrivilegedUser(role: PlatformRole) {
    const email = `${role.toLowerCase()}_${Date.now()}_${Math.floor(
      Math.random() * 10000,
    )}@test.com`;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: `${role} User`,
        email,
        password: 'secret123',
      })
      .expect(201);

    const item = unwrapItem(response.body);
    const privilegedUserId = item.user.id;

    const user =
      await usersService.findByIdWithVerificationFields(privilegedUserId);
    user.emailVerifiedAt = new Date();
    user.phoneNumber = '+22670000000';
    user.platformRole = role;
    await usersService.save(user);

    return {
      token: item.accessToken,
      userId: privilegedUserId,
      email,
    };
  }

  async function registerPlainUser(prefix: string) {
    const email = `${prefix}_${Date.now()}_${Math.floor(
      Math.random() * 10000,
    )}@test.com`;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: prefix,
        email,
        password: 'secret123',
      })
      .expect(201);

    const item = unwrapItem(response.body);
    await makeUserEventReady(item.user.id);

    return {
      token: item.accessToken,
      userId: item.user.id,
      email,
    };
  }

  async function createWishlistItemForEvent(
    name: string,
    price = 100000,
    quantity = 1,
  ) {
    const response = await request(app.getHttpServer())
      .post('/wishlist-items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name,
        wishlistId,
        price,
        quantity,
      })
      .expect(201);

    return unwrapItem(response.body);
  }

  it('POST /auth/register -> should register a user', async () => {
    const email = `john_${Date.now()}@test.com`;

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'John Test',
        email,
        password: 'secret123',
      })
      .expect(201);

    const item = unwrapItem(response.body);

    expect(item).toHaveProperty('accessToken');
    expect(item).toHaveProperty('user');
    expect(item.user.name).toBe('John Test');
    expect(item.user.email).toBe(email);

    accessToken = item.accessToken;
    userId = item.user.id;

    await makeUserEventReady(userId);
  });

  it('GET /auth/me -> should return current user', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const item = unwrapItem(response.body);

    expect(item.id).toBe(userId);
    expect(item.name).toBe('John Test');
  });

  it('POST /events -> should create an event', async () => {
    const response = await request(app.getHttpServer())
      .post('/events')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Anniversaire E2E',
        eventDate: '2026-04-15T18:00:00.000Z',
        description: 'Test e2e',
      })
      .expect(201);

    const item = unwrapItem(response.body);

    expect(item).toBeDefined();
    expect(item.eventId).toBeDefined();
    expect(item.wishlistId).toBeDefined();

    eventId = item.eventId;
    wishlistId = item.wishlistId;
  });

  it('GET /wishlists -> should find auto-created wishlist for event', async () => {
    const response = await request(app.getHttpServer())
      .get('/wishlists')
      .expect(200);

    const items = unwrapItems(response.body);
    const wishlist = items.find((w: any) => w.event?.id === eventId);

    expect(wishlist).toBeDefined();
    wishlistId = wishlist.id;
  });

  it('POST /wishlist-items -> should create item linked to event', async () => {
    expect(wishlistId).not.toBeNull();

    const item = await createWishlistItemForEvent('iPhone 13', 800000, 1);

    expect(item).toHaveProperty('id');
    expect(item.name).toBe('iPhone 13');

    wishlistItemId = item.id;
  });

  it('GET /events/:id/wishlist -> should return created item', async () => {
    const response = await request(app.getHttpServer())
      .get(`/events/${eventId}/wishlist`)
      .expect(200);

    const data = unwrapData(response.body);
    const items = data.items ?? unwrapItems(response.body);

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);

    const item = items.find((i: any) => i.id === wishlistItemId);
    expect(item).toBeDefined();
  });

  it('POST /contributions/checkout -> should create contribution and payment init', async () => {
    const response = await request(app.getHttpServer())
      .post('/contributions/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        wishlistItemId: Number(wishlistItemId),
        amount: 50000,
        currencyCode: 'XOF',
        isAnonymous: false,
        message: 'Ma participation e2e',
      })
      .expect(201);

    const data = unwrapData(response.body);

    expect(data.contribution).toBeDefined();
    expect(data.payment).toBeDefined();
    expect(data.contribution.status).toBe('AWAITING_PAYMENT');
    expect(data.payment.status).toBe('INITIATED');

    contributionId = data.contribution.id;
    paymentId = data.payment.id;
  });

  it('markAsSucceeded -> should confirm payment and contribution', async () => {
    const item = await paymentsService.markAsSucceeded(paymentId, {
      providerTransactionId: `TRX-${Date.now()}`,
      providerReference: `REF-${Date.now()}`,
    });

    expect(item.status).toBe('SUCCEEDED');
  });

  it('GET /wishlist-items/:id -> should show updated funded amount', async () => {
    const response = await request(app.getHttpServer())
      .get(`/wishlist-items/${wishlistItemId}`)
      .expect(200);

    const data = unwrapData(response.body);

    expect(data.item.id).toBe(wishlistItemId);
    expect(data.item.fundedAmount).toBe(50000);
    expect(data.item.remainingAmount).toBeGreaterThanOrEqual(0);
    expect(data.stats.confirmedContributionsCount).toBeGreaterThanOrEqual(1);
  });

  it('GET /payments/me -> should return current user payments', async () => {
    const response = await request(app.getHttpServer())
      .get('/payments/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const items = unwrapItems(response.body);

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);

    const payment = items.find((p: any) => p.id === paymentId);
    expect(payment).toBeDefined();
  });

  it('GET /contributions/me -> should return current user contributions', async () => {
    const response = await request(app.getHttpServer())
      .get('/contributions/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const data = unwrapData(response.body);
    const items = data.items ?? [];

    expect(Array.isArray(items)).toBe(true);

    const contribution = items.find((c: any) => c.id === contributionId);
    expect(contribution).toBeDefined();
  });

  it('should block suspended user login and access', async () => {
    const email = `suspended_${Date.now()}@test.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Suspended User',
        email,
        password: 'secret123',
      })
      .expect(201);

    const registerItem = unwrapItem(registerResponse.body);
    const suspendedToken = registerItem.accessToken;
    const suspendedUserId = registerItem.user.id;

    await makeUserEventReady(suspendedUserId, '+22671111111');

    await usersService.suspendUser(
      suspendedUserId,
      { userId, platformRole: PlatformRole.SUPER_ADMIN },
      'E2E suspension',
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'secret123',
      })
      .expect(401);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .expect(401);
  });

  it('should expire payment after expiration date', async () => {
    const expiringItem = await createWishlistItemForEvent(
      `Expire Payment ${Date.now()}`,
      70000,
      1,
    );

    const contributionResponse = await request(app.getHttpServer())
      .post('/contributions/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        wishlistItemId: Number(expiringItem.id),
        amount: 10000,
        currencyCode: 'XOF',
        isAnonymous: false,
        message: 'Contribution expiration payment',
      })
      .expect(201);

    const contributionData = unwrapData(contributionResponse.body);
    const expiringPaymentId = contributionData.payment.id;

    const paymentEntity = await (paymentsService as any).paymentsRepository.findOne({
      where: { id: expiringPaymentId },
      relations: ['contribution', 'payer'],
    });

    expect(paymentEntity).toBeDefined();

    paymentEntity.expiresAt = new Date(Date.now() - 60_000);
    await (paymentsService as any).paymentsRepository.save(paymentEntity);

    const cleanupResult = await paymentsService.expirePendingPayments();
    expect(cleanupResult.expired).toBeGreaterThanOrEqual(1);

    const response = await request(app.getHttpServer())
      .get(`/payments/${expiringPaymentId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const item = unwrapItem(response.body);
    expect(item.status).toBe('FAILED');
  });

  it('should process webhook only once (idempotent)', async () => {
    const itemForWebhook = await createWishlistItemForEvent(
      `Webhook Item ${Date.now()}`,
      120000,
      1,
    );

    const checkoutResponse = await request(app.getHttpServer())
      .post('/contributions/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        wishlistItemId: Number(itemForWebhook.id),
        amount: 15000,
        currencyCode: 'XOF',
        isAnonymous: false,
        message: 'Contribution webhook',
      })
      .expect(201);

    const checkoutData = unwrapData(checkoutResponse.body);
    const webhookPaymentId = checkoutData.payment.id;

    const payload = {
      provider: 'MOCK',
      paymentId: webhookPaymentId,
      status: 'SUCCEEDED',
      providerTransactionId: `tx-${Date.now()}`,
      providerReference: `ref-${Date.now()}`,
    };

    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'test-secret';

    const first = await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('x-webhook-secret', secret)
      .send(payload)
      .expect(201);

    const firstData = unwrapData(first.body);
    expect(firstData.idempotent).toBe(false);

    const second = await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('x-webhook-secret', secret)
      .send(payload)
      .expect(201);

    const secondData = unwrapData(second.body);
    expect(secondData.idempotent).toBe(true);
  });

  it('should expire reservation and release item', async () => {
    const reservationItem = await createWishlistItemForEvent(
      `Reservation Item ${Date.now()}`,
      60000,
      1,
    );

    const reservationResponse = await request(app.getHttpServer())
      .post('/reservations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        wishlistItemId: reservationItem.id,
        eventId,
      })
      .expect(201);

    const reservationData = unwrapItem(reservationResponse.body);
    const reservationId = reservationData.id;

    const reservationEntity = await (reservationsService as any).reservationsRepository.findOne({
      where: { id: reservationId },
      relations: ['wishlistItem', 'reservedBy', 'event'],
    });

    expect(reservationEntity).toBeDefined();

    reservationEntity.expiresAt = new Date(Date.now() - 60_000);
    await (reservationsService as any).reservationsRepository.save(
      reservationEntity,
    );

    const cleanup = await reservationsService.cleanupExpiredReservations();
    expect(cleanup.processed).toBeGreaterThanOrEqual(1);

    const reservationCheck = await (reservationsService as any).reservationsRepository.findOne({
      where: { id: reservationId },
      relations: ['wishlistItem', 'reservedBy', 'event'],
    });

    expect(reservationCheck?.status).toBe('EXPIRED');

    const wishlistItemCheck = await (reservationsService as any).wishlistItemsRepository.findOne({
      where: { id: reservationItem.id },
    });

    expect(wishlistItemCheck?.isReserved).toBe(false);
  });

  describe('Admin E2E', () => {
    it('SUPER_ADMIN can update a USER role to ADMIN', async () => {
      const target = await registerPlainUser('role_target_user');

      const response = await request(app.getHttpServer())
        .patch(`/users/admin/${target.userId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: PlatformRole.ADMIN })
        .expect(200);

      const item = unwrapItem(response.body);
      expect(item.platformRole).toBe(PlatformRole.ADMIN);
    });

    it('ADMIN cannot update role because route is SUPER_ADMIN only', async () => {
      const target = await registerPlainUser('role_forbidden_target');

      await request(app.getHttpServer())
        .patch(`/users/admin/${target.userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: PlatformRole.ADMIN })
        .expect(403);
    });

    it('SUPER_ADMIN cannot update their own role', async () => {
      await request(app.getHttpServer())
        .patch(`/users/admin/${superAdminUserId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: PlatformRole.ADMIN })
        .expect(400);
    });

    it('SUPER_ADMIN cannot update another SUPER_ADMIN role', async () => {
      const anotherSuperAdmin = await createPrivilegedUser(
        PlatformRole.SUPER_ADMIN,
      );

      await request(app.getHttpServer())
        .patch(`/users/admin/${anotherSuperAdmin.userId}/role`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: PlatformRole.ADMIN })
        .expect(400);
    });

    it('ADMIN can suspend a USER', async () => {
      const target = await registerPlainUser('suspend_user_target');

      const response = await request(app.getHttpServer())
        .patch(`/users/admin/${target.userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'admin suspend test' })
        .expect(200);

      const item = unwrapItem(response.body);
      expect(item.isSuspended).toBe(true);
    });

    it('ADMIN cannot suspend another ADMIN', async () => {
      const targetAdmin = await createPrivilegedUser(PlatformRole.ADMIN);

      await request(app.getHttpServer())
        .patch(`/users/admin/${targetAdmin.userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'should fail' })
        .expect(400);
    });

    it('SUPER_ADMIN can suspend an ADMIN', async () => {
      const targetAdmin = await createPrivilegedUser(PlatformRole.ADMIN);

      const response = await request(app.getHttpServer())
        .patch(`/users/admin/${targetAdmin.userId}/suspend`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'super admin suspend admin' })
        .expect(200);

      const item = unwrapItem(response.body);
      expect(item.isSuspended).toBe(true);
    });

    it('cannot suspend a SUPER_ADMIN', async () => {
      const targetSuperAdmin = await createPrivilegedUser(
        PlatformRole.SUPER_ADMIN,
      );

      await request(app.getHttpServer())
        .patch(`/users/admin/${targetSuperAdmin.userId}/suspend`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'should fail' })
        .expect(400);
    });

    it('ADMIN can unsuspend a USER', async () => {
      const target = await registerPlainUser('unsuspend_user_target');

      await request(app.getHttpServer())
        .patch(`/users/admin/${target.userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'temporary suspend' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/users/admin/${target.userId}/unsuspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const item = unwrapItem(response.body);
      expect(item.isSuspended).toBe(false);
    });

    it('suspended user cannot login, then can login again after unsuspend', async () => {
      const target = await registerPlainUser('unsuspend_login_target');

      await request(app.getHttpServer())
        .patch(`/users/admin/${target.userId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'block login' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: target.email,
          password: 'secret123',
        })
        .expect(401);

      await request(app.getHttpServer())
        .patch(`/users/admin/${target.userId}/unsuspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: target.email,
          password: 'secret123',
        })
        .expect(201);

      const loginItem = unwrapItem(loginResponse.body);
      expect(loginItem.accessToken).toBeDefined();
    });

    it('ADMIN can refund a SUCCEEDED payment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'admin refund test' })
        .expect(200);

      const item = unwrapItem(response.body);
      expect(item.status).toBe('REFUNDED');
    });

    it('cannot refund the same payment twice', async () => {
      await request(app.getHttpServer())
        .patch(`/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'refund again' })
        .expect(400);
    });

    it('ADMIN can read audit logs', async () => {
      const response = await request(app.getHttpServer())
        .get('/audit/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = unwrapData(response.body);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.total).toBeGreaterThan(0);
    });

    it('ADMIN can filter audit logs by USER_SUSPENDED action', async () => {
      const response = await request(app.getHttpServer())
        .get('/audit/admin/logs?action=USER_SUSPENDED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = unwrapData(response.body);
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('ADMIN can read audit log details', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/audit/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const listData = unwrapData(listResponse.body);
      expect(Array.isArray(listData.items)).toBe(true);
      expect(listData.items.length).toBeGreaterThan(0);

      const logId = listData.items[0].id;

      const detailResponse = await request(app.getHttpServer())
        .get(`/audit/admin/logs/${logId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const item = unwrapItem(detailResponse.body);
      expect(item.id).toBe(logId);
    });

    it('non-admin cannot read audit logs', async () => {
      await request(app.getHttpServer())
        .get('/audit/admin/logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });
});
