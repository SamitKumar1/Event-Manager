import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole, EventStatus, ReservationStatus } from '@prisma/client';

describe('OrdersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let otherToken: string;
  let ticketTypeId: string;
  let reservationId: string;

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

    // Attendee user
    const user = await prisma.user.create({
      data: { name: 'User', email: `user_${unique}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'test-password' })
      .expect(200);
    userToken = userLogin.body.accessToken;

    // Other user
    const other = await prisma.user.create({
      data: { name: 'Other', email: `other_${unique}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: other.email, password: 'test-password' })
      .expect(200);
    otherToken = otherLogin.body.accessToken;

    // Organization with user as member
    const org = await prisma.organization.create({
      data: {
        name: 'Order Org',
        slug: `order-org-${unique}`,
        members: { create: [{ userId: user.id, role: OrganizationRole.MEMBER }] },
      },
    });

    // Event published
    const evt = await prisma.event.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        title: 'Order Event',
        slug: 'order-event',
        startAt: new Date('2025-10-10T10:00:00Z'),
        endAt: new Date('2025-10-10T12:00:00Z'),
        timezone: 'UTC',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        status: EventStatus.PUBLISHED,
      },
    });

    // Ticket type
    const tt = await prisma.ticketType.create({
      data: {
        eventId: evt.id,
        name: 'General',
        price: 25,
        quantity: 10,
        salesStartAt: new Date('2020-01-01'),
        salesEndAt: new Date('2030-01-01'),
      },
    });
    ticketTypeId = tt.id;

    // Active reservation for user
    const resv = await prisma.ticketReservation.create({
      data: {
        ticketTypeId,
        userId: user.id,
        quantity: 3,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    reservationId = resv.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let createdOrderId: string;

  it('POST /orders - create order from reservation', () => {
    return request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ ticketTypeId, quantity: 2 }] })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        createdOrderId = res.body.id;
        expect(res.body.status).toBe('PENDING');
        // Decimal may serialize as "50" or "50.00"
        expect(String(res.body.totalAmount)).toMatch(/^50(\.00)?$/);
        expect(res.body.items.length).toBe(1);
        expect(String(res.body.items[0].unitPrice)).toMatch(/^25(\.00)?$/);
        expect(res.body.items[0].quantity).toBe(2);
      });
  });

  it('GET /orders/me - list my orders', () => {
    return request(app.getHttpServer())
      .get('/api/v1/orders/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      });
  });

  it('GET /orders/:id - get own order', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(createdOrderId);
        expect(res.body.status).toBe('PENDING');
      });
  });

  it('GET /orders/:id - other user cannot access', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('POST /orders/:id/cancel - owner can cancel pending', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/orders/${createdOrderId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toBe('Order cancelled');
      });
  });

  it('GET /orders/:id after cancel shows CANCELLED', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CANCELLED');
      });
  });

});