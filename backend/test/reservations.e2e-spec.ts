import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole, EventStatus, ReservationStatus } from '@prisma/client';

describe('ReservationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let userToken: string;
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

    // Owner user (organizer)
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: `owner_res_${unique}@example.com`, passwordHash, role: Role.ORGANIZER },
    });
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'test-password' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    // Regular attendee user
    const attendee = await prisma.user.create({
      data: { name: 'Attendee', email: `att_res_${unique}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    const attendeeLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: attendee.email, password: 'test-password' })
      .expect(200);
    userToken = attendeeLogin.body.accessToken;

    // Organization with owner as OWNER
    const org = await prisma.organization.create({
      data: {
        name: 'Res Org',
        slug: `res-org-${unique}`,
        members: { create: [{ userId: owner.id, role: OrganizationRole.OWNER }] },
      },
    });

    // Event published
    const evt = await prisma.event.create({
      data: {
        organizationId: org.id,
        createdById: owner.id,
        title: 'Reservation Event',
        slug: 'res-event',
        startAt: new Date('2025-10-10T10:00:00Z'),
        endAt: new Date('2025-10-10T12:00:00Z'),
        timezone: 'UTC',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        status: EventStatus.PUBLISHED,
      },
    });

    // Ticket type with quantity 5
    const tt = await prisma.ticketType.create({
      data: {
        eventId: evt.id,
        name: 'General',
        price: 20,
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

  let reservationId: string;

  it('POST /ticket-types/:ticketTypeId/reservations - user can reserve', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/ticket-types/${ticketTypeId}/reservations`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 2 })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        reservationId = res.body.id;
        expect(res.body.quantity).toBe(2);
        expect(res.body.status).toBe('ACTIVE');
      });
  });

  it('GET /reservations/:id - owner can view', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(reservationId);
        expect(res.body.quantity).toBe(2);
      });
  });

  it('GET /users/me/reservations - list user reservations', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/me/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      });
  });

  it('POST /reservations/:id/cancel - owner can cancel', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toBe('Reservation cancelled');
      });
  });

  it('GET /reservations/:id after cancel returns EXPIRED? actually CANCELLED status', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CANCELLED');
      });
  });

  it('Another user cannot access reservation', async () => {
    // create another user
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
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('Insufficient inventory rejected', () => {
    // ticket type quantity 5, already reserved 2 then cancelled (released), but we need test with active reservation
    // create new reservation of 4, then attempt another 2 -> should fail (total >5)
    return request(app.getHttpServer())
      .post(`/api/v1/ticket-types/${ticketTypeId}/reservations`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 4 })
      .expect(201)
      .then(() =>
        request(app.getHttpServer())
          .post(`/api/v1/ticket-types/${ticketTypeId}/reservations`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ quantity: 2 })
          .expect(409)
      );
  });
});