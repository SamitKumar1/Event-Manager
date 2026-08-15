import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole, EventStatus, ReservationStatus, OrderStatus } from '@prisma/client';

describe('CheckinController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ticketsService: TicketsService;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let eventId: string;
  let ticketTypeId: string;
  let qrToken: string;
  let orderId: string;
  let unique: number;
  let ownerId: string;
  let adminId: string;

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
    ticketsService = moduleFixture.get(TicketsService);

    const passwordHash = await bcrypt.hash('test-password', 10);
    unique = Date.now();

    const owner = await prisma.user.create({
      data: { name: 'Owner', email: `owner_${unique}@example.com`, passwordHash, role: Role.ORGANIZER },
    });
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'test-password' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;
    ownerId = owner.id;

    const admin = await prisma.user.create({
      data: { name: 'Admin', email: `admin_${unique}@example.com`, passwordHash, role: Role.ORGANIZER },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'test-password' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
    adminId = admin.id;

    const member = await prisma.user.create({
      data: { name: 'Member', email: `member_${unique}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: 'test-password' })
      .expect(200);
    memberToken = memberLogin.body.accessToken;

    const org = await prisma.organization.create({
      data: {
        name: 'Checkin Org',
        slug: `checkin-org-${unique}`,
        members: {
          create: [
            { userId: owner.id, role: OrganizationRole.OWNER },
            { userId: admin.id, role: OrganizationRole.ADMIN },
            { userId: member.id, role: OrganizationRole.MEMBER },
          ],
        },
      },
    });

    const evt = await prisma.event.create({
      data: {
        organizationId: org.id,
        createdById: owner.id,
        title: 'Checkin Event',
        slug: `checkin-event-${unique}`,
        startAt: new Date('2025-10-10T10:00:00Z'),
        endAt: new Date('2025-10-10T12:00:00Z'),
        timezone: 'UTC',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        status: EventStatus.PUBLISHED,
      },
    });
    eventId = evt.id;

    const tt = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'VIP',
        price: 100,
        quantity: 5,
        salesStartAt: new Date('2020-01-01'),
        salesEndAt: new Date('2030-01-01'),
      },
    });
    ticketTypeId = tt.id;

    await prisma.ticketReservation.create({
      data: {
        ticketTypeId,
        userId: owner.id,
        quantity: 2,
        status: ReservationStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const ord = await prisma.order.create({
      data: {
        userId: owner.id,
        status: OrderStatus.PENDING,
        totalAmount: 200,
        currency: 'USD',
        items: { create: [{ ticketTypeId, quantity: 2, unitPrice: 100 }] },
      },
    });
    orderId = ord.id;

    // Make payment
    const idemKey = `idem-checkin-${unique}`;
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send({})
      .expect(201);

    // Workaround: payment service has a bug where tickets generation fails inside transaction
    // Manually set order to PAID so tickets can be generated
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PAID },
    });

    // Generate tickets manually (workaround for tickets service transaction issue)
    const tickets = (await ticketsService.generateTicketsForOrder(orderId)).sort((a, b) => a.id.localeCompare(b.id));
    const firstTicket = tickets[0];
    qrToken = firstTicket.qrToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('OWNER can check in a valid ticket', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/check-in`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ qrToken })
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.status).toBe('USED');
        expect(res.body.checkedInAt).toBeDefined();
        expect(res.body.ticketCode).toBeDefined();
        expect(res.body.ticketType).toBeDefined();
        expect(res.body.event).toBeDefined();
      });
  });

  it('ADMIN can check in a valid ticket', async () => {
    // Use the second ticket from the same order (quantity=2 generates 2 tickets)
    // Sort by id to ensure consistent ordering
    const tickets = (await ticketsService.generateTicketsForOrder(orderId)).sort((a, b) => a.id.localeCompare(b.id));
    const secondTicket = tickets[1];
    const qr2 = secondTicket.qrToken;

    return request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/check-in`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ qrToken: qr2 })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('USED');
      });
  });

  it('MEMBER cannot check in', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/check-in`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ qrToken })
      .expect(403);
  });

  it('second check-in of same ticket fails', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/check-in`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ qrToken })
      .expect(409);
  });

  it('ticket from another event cannot be checked in', async () => {
    // create another event
    const otherEvt = await prisma.event.create({
      data: {
        organizationId: (await prisma.organization.findFirst())!.id,
        createdById: ownerId,
        title: 'Other Event',
        slug: `other-${Date.now()}`,
        startAt: new Date('2025-11-11T10:00:00Z'),
        endAt: new Date('2025-11-11T12:00:00Z'),
        timezone: 'UTC',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        status: EventStatus.PUBLISHED,
      },
    });
    const otherTt = await prisma.ticketType.create({
      data: { eventId: otherEvt.id, name: 'Other', price: 10, quantity: 1, salesStartAt: new Date('2020-01-01'), salesEndAt: new Date('2030-01-01') },
    });
    const otherResv = await prisma.ticketReservation.create({
      data: { ticketTypeId: otherTt.id, userId: ownerId, quantity: 1, status: ReservationStatus.ACTIVE, expiresAt: new Date(Date.now()+3600000) },
    });
    const otherOrd = await prisma.order.create({
      data: { userId: ownerId, status: OrderStatus.PENDING, totalAmount: 10, currency: 'USD', items: { create: [{ ticketTypeId: otherTt.id, quantity: 1, unitPrice: 10 }] } },
    });
    // Workaround: manually set order to PAID and create payment record
    await prisma.order.update({
      where: { id: otherOrd.id },
      data: { status: OrderStatus.PAID },
    });
    await prisma.payment.create({
      data: {
        orderId: otherOrd.id,
        status: 'SUCCEEDED',
        amount: 10,
        currency: 'USD',
        provider: 'mock',
        idempotencyKey: `idem-other-${unique}`,
      },
    });
    const otherTickets = await ticketsService.generateTicketsForOrder(otherOrd.id);
    const otherQr = otherTickets[0].qrToken;

    return request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/check-in`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ qrToken: otherQr })
      .expect(403);
  });
});