import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExpirationService } from '../src/modules/expiration/expiration.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole, EventStatus, ReservationStatus, OrderStatus } from '@prisma/client';

describe('ExpirationController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let reservationId: string;
  let ticketTypeId: string;
  let orderId: string;

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
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'test-password' })
      .expect(200);
    ownerToken = login.body.accessToken;

    const org = await prisma.organization.create({
      data: {
        name: 'Expire Org',
        slug: `expire-org-${unique}`,
        members: { create: [{ userId: user.id, role: OrganizationRole.MEMBER }] },
      },
    });

    const evt = await prisma.event.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        title: 'Expire Event',
        slug: `expire-event-${unique}`,
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

    // reservation active but expired
    const past = new Date(Date.now() - 60000);
    const resv = await prisma.ticketReservation.create({
      data: {
        ticketTypeId,
        userId: user.id,
        quantity: 2,
        status: ReservationStatus.ACTIVE,
        expiresAt: past,
      },
    });
    reservationId = resv.id;

    // order
    const ord = await prisma.order.create({
      data: {
        userId: user.id,
        status: OrderStatus.PENDING,
        totalAmount: 60,
        currency: 'USD',
        items: { create: [{ ticketTypeId, quantity: 2, unitPrice: 30 }] },
      },
    });
    orderId = ord.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should expire active reservations via service', async () => {
    const expirationService = app.get(ExpirationService);
    const count = await expirationService.expireNow();
    expect(count).toBeGreaterThanOrEqual(1);

    const reservation = await prisma.ticketReservation.findUnique({ where: { id: reservationId } });
    expect(reservation?.status).toBe('EXPIRED');
  });

  it('should not affect future reservations', async () => {
    const future = new Date(Date.now() + 3600000);
    
    const event = await prisma.event.findFirst();
    expect(event).toBeTruthy();
    const ticketType = await prisma.ticketType.findFirst({ where: { eventId: event!.id } });
    expect(ticketType).toBeTruthy();
    const user = await prisma.user.findFirst({ where: { role: Role.ATTENDEE } });
    expect(user).toBeTruthy();

    const resv = await prisma.ticketReservation.create({
      data: {
        ticketTypeId: ticketType!.id,
        userId: user!.id,
        quantity: 1,
        status: ReservationStatus.ACTIVE,
        expiresAt: future,
      },
    });

    const expirationService = app.get(ExpirationService);
    await expirationService.expireNow();

    const reservation = await prisma.ticketReservation.findUnique({ where: { id: resv.id } });
    expect(reservation.status).toBe('ACTIVE');
  });
});