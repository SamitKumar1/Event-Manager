import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole, EventStatus, ReservationStatus, OrderStatus, TicketStatus } from '@prisma/client';

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let orgId: string;
  let eventId: string;
  let ticketTypeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const passwordHash = await bcrypt.hash('test-password', 10);
    const unique = Date.now();

    // Owner user (ORGANIZER global role)
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: `owner_${unique}@example.com`, passwordHash, role: Role.ORGANIZER },
    });
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'test-password' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    // Admin user (ORGANIZER global role)
    const admin = await prisma.user.create({
      data: { name: 'Admin', email: `admin_${unique}@example.com`, passwordHash, role: Role.ORGANIZER },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'test-password' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    // Member user (ATTENDEE global role)
    const member = await prisma.user.create({
      data: { name: 'Member', email: `member_${unique}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: 'test-password' })
      .expect(200);
    memberToken = memberLogin.body.accessToken;

    // Organization with owner as OWNER, admin as ADMIN, member as MEMBER
    const org = await prisma.organization.create({
      data: {
        name: 'Analytics Org',
        slug: `analytics-org-${unique}`,
        members: {
          create: [
            { userId: owner.id, role: OrganizationRole.OWNER },
            { userId: admin.id, role: OrganizationRole.ADMIN },
            { userId: member.id, role: OrganizationRole.MEMBER },
          ],
        },
      },
    });
    orgId = org.id;

    // Event published
    const evt = await prisma.event.create({
      data: {
        organizationId: orgId,
        createdById: owner.id,
        title: 'Analytics Event',
        slug: `analytics-event-${unique}`,
        startAt: new Date('2025-10-10T10:00:00Z'),
        endAt: new Date('2025-10-10T12:00:00Z'),
        timezone: 'UTC',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        status: EventStatus.PUBLISHED,
      },
    });
    eventId = evt.id;

    // Ticket type
    const tt = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'VIP',
        price: 100,
        quantity: 10,
        salesStartAt: new Date('2020-01-01'),
        salesEndAt: new Date('2030-01-01'),
      },
    });
    ticketTypeId = tt.id;

    // Reservation (ACTIVE)
    await prisma.ticketReservation.create({
      data: {
        ticketTypeId,
        userId: owner.id,
        quantity: 2,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Order
    const ord = await prisma.order.create({
      data: {
        userId: owner.id,
        status: OrderStatus.PENDING,
        totalAmount: 200,
        currency: 'USD',
        items: { create: [{ ticketTypeId, quantity: 2, unitPrice: 100 }] },
      },
    });

    // Mock payment success via endpoint
    const idemKey = `idem-analytics-${unique}`;
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${ord.id}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({})
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('OWNER can get event analytics', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/analytics`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.eventId).toBe(eventId);
        expect(res.body.totalTicketCapacity).toBeGreaterThan(0);
        expect(typeof res.body.attendanceRate).toBe('number');
      });
  });

  it('ADMIN can get event analytics', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/analytics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.eventId).toBe(eventId);
      });
  });

  it('MEMBER cannot access event analytics', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/analytics`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('OWNER can get organization analytics', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/analytics`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.organizationId).toBeDefined();
        expect(res.body.totalEvents).toBeGreaterThanOrEqual(1);
      });
  });

  it('ADMIN can get organization analytics', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/analytics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.organizationId).toBeDefined();
      });
  });

  it('MEMBER cannot access organization analytics', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/analytics`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('unrelated user cannot access organization analytics', async () => {
    const otherEmail = `other_${Date.now()}@example.com`;
    const other = await prisma.user.create({
      data: { name: 'Other', email: otherEmail, passwordHash: await bcrypt.hash('test-password', 10), role: Role.ATTENDEE },
    });
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password: 'test-password' })
      .expect(200);
    const otherToken = otherLogin.body.accessToken;

    return request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/analytics`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });
});