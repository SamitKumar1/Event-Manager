import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole, EventStatus, ReservationStatus, OrderStatus } from '@prisma/client';

describe('PaymentsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let ticketTypeId: string;
  let userId: string;

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

    const user = await prisma.user.create({
      data: { name: 'Pay User', email: `pay_${unique}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    userId = user.id;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'test-password' })
      .expect(200);
    userToken = login.body.accessToken;

    const org = await prisma.organization.create({
      data: {
        name: 'Pay Org',
        slug: `pay-org-${unique}`,
        members: { create: [{ userId: user.id, role: OrganizationRole.MEMBER }] },
      },
    });

    const evt = await prisma.event.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        title: 'Pay Event',
        slug: 'pay-event',
        startAt: new Date('2025-10-10T10:00:00Z'),
        endAt: new Date('2025-10-10T12:00:00Z'),
        timezone: 'UTC',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        status: EventStatus.PUBLISHED,
      },
    });

    const tt = await prisma.ticketType.create({
      data: {
        eventId: evt.id,
        name: 'Pay Ticket',
        price: 30,
        quantity: 5,
        salesStartAt: new Date('2020-01-01'),
        salesEndAt: new Date('2030-01-01'),
      },
    });
    ticketTypeId = tt.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let idempotencyCounter = 0;
  function uniqueIdemKey(prefix: string): string {
    return `${prefix}-${Date.now()}-${++idempotencyCounter}`;
  }

  async function createPendingOrder(): Promise<string> {
    await prisma.ticketReservation.create({
      data: {
        ticketTypeId,
        userId,
        quantity: 2,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const ord = await prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        totalAmount: 60,
        currency: 'USD',
        items: { create: [{ ticketTypeId, quantity: 2, unitPrice: 30 }] },
      },
    });
    return ord.id;
  }

  it('POST /orders/:orderId/payments - successful payment', async () => {
    const orderId = await createPendingOrder();
    const idemKey = uniqueIdemKey('pay-1');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', idemKey)
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe('SUCCEEDED');
        expect(String(res.body.amount)).toMatch(/^60(\.00)?$/);
      });

    const orderAfter = await prisma.order.findUnique({ where: { id: orderId } });
    expect(orderAfter?.status).toBe(OrderStatus.PAID);
    const paymentAfter = await prisma.payment.findUnique({ where: { id: res.body.id } });
    expect(paymentAfter?.orderId).toBe(orderId);
  });

  it('GET /payments/:id - retrieve payment', async () => {
    const orderId = await createPendingOrder();
    const idemKey = uniqueIdemKey('pay-get');
    const payResp = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', idemKey)
      .send({})
      .expect(201);
    const pid = payResp.body.id;
    return request(app.getHttpServer())
      .get(`/api/v1/payments/${pid}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(pid);
        expect(res.body.status).toBe('SUCCEEDED');
      });
  });

  it('Second payment on already paid order fails with new key', async () => {
    const orderId = await createPendingOrder();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', uniqueIdemKey('pay-first'))
      .send({})
      .expect(201);

    return request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', uniqueIdemKey('pay-second'))
      .send({})
      .expect(400);
  });

  it('Duplicate idempotency key returns existing payment', async () => {
    const orderId = await createPendingOrder();
    const idemKey = `pay-duplicate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    // First request creates the payment
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', idemKey)
      .send({})
      .expect(201);

    // Second request with same key returns existing payment
    return request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', idemKey)
      .send({})
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('SUCCEEDED');
      });
  });

  it('Another user cannot pay for the order', async () => {
    const orderId = await createPendingOrder();
    const passwordHash = await bcrypt.hash('test-password', 10);
    const other = await prisma.user.create({
      data: { name: 'Other', email: `other_${Date.now()}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: other.email, password: 'test-password' })
      .expect(200);
    const otherToken = otherLogin.body.accessToken;

    return request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('Idempotency-Key', uniqueIdemKey('pay-other'))
      .send({})
      .expect(403);
  });

  it('Already paid order cannot be charged again with new key', async () => {
    const orderId = await createPendingOrder();
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', uniqueIdemKey('pay-first-key'))
      .send({})
      .expect(201);

    return request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${userToken}`)
      .set('Idempotency-Key', uniqueIdemKey('pay-second-key'))
      .send({})
      .expect(400);
  });
});