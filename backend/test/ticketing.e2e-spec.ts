import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole } from '@prisma/client';

describe('TicketingController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let orgId: string;
  let eventId: string;

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

    // Owner user
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: `owner_t_${unique}@example.com`, passwordHash, role: Role.ORGANIZER },
    });
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'test-password' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    // Admin user
    const admin = await prisma.user.create({
      data: { name: 'Admin', email: `admin_t_${unique}@example.com`, passwordHash, role: Role.ORGANIZER },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'test-password' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    // Member user
    const member = await prisma.user.create({
      data: { name: 'Member', email: `member_t_${unique}@example.com`, passwordHash, role: Role.ATTENDEE },
    });
    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: 'test-password' })
      .expect(200);
    memberToken = memberLogin.body.accessToken;

    // Organization with roles
    const org = await prisma.organization.create({
      data: {
        name: 'Ticket Org',
        slug: `ticket-org-${unique}`,
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

    // Event
    const evt = await prisma.event.create({
      data: {
        organizationId: orgId,
        createdById: owner.id,
        title: 'Test Event',
        slug: 'test-event',
        startAt: new Date('2025-10-10T10:00:00Z'),
        endAt: new Date('2025-10-10T12:00:00Z'),
        timezone: 'UTC',
        locationType: 'ONLINE',
        venueName: 'Zoom',
      },
    });
    eventId = evt.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let createdTicketTypeId: string;

  it('POST /events/:eventId/ticket-types - owner can create', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/ticket-types`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Early Bird',
        description: 'Early bird ticket',
        price: 49.99,
        quantity: 100,
        salesStartAt: '2025-01-01T00:00:00Z',
        salesEndAt: '2025-09-01T00:00:00Z',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        createdTicketTypeId = res.body.id;
        expect(res.body.name).toBe('Early Bird');
        // Prisma Decimal is returned as string
        expect(res.body.price).toBe('49.99');
      });
  });

  it('POST /events/:eventId/ticket-types - member cannot create', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/ticket-types`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        name: 'Member Ticket',
        price: 10,
        quantity: 10,
        salesStartAt: '2025-01-01T00:00:00Z',
        salesEndAt: '2025-09-01T00:00:00Z',
      })
      .expect(403);
  });

  it('GET /events/:eventId/ticket-types - member can list', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/ticket-types`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.items.length).toBeGreaterThan(0);
      });
  });

  it('GET /ticket-types/:id - member can view', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/ticket-types/${createdTicketTypeId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(createdTicketTypeId);
      });
  });

  it('PATCH /ticket-types/:id - admin can update', () => {
    return request(app.getHttpServer())
      .patch(`/api/v1/ticket-types/${createdTicketTypeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 39.99 })
      .expect(200)
      .expect((res) => {
        expect(res.body.price).toBe('39.99');
      });
  });

  it('PATCH /ticket-types/:id - member cannot update', () => {
    return request(app.getHttpServer())
      .patch(`/api/v1/ticket-types/${createdTicketTypeId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ price: 5 })
      .expect(403);
  });

  it('DELETE /ticket-types/:id - owner can delete', () => {
    return request(app.getHttpServer())
      .delete(`/api/v1/ticket-types/${createdTicketTypeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toBe('Ticket type deleted');
      });
  });

  it('DELETE /ticket-types/:id - admin cannot delete', async () => {
    // create another ticket type
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/ticket-types`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Regular',
        price: 99,
        quantity: 50,
        salesStartAt: '2025-01-01T00:00:00Z',
        salesEndAt: '2025-09-01T00:00:00Z',
      })
      .expect(201);
    const newId = createRes.body.id;
    return request(app.getHttpServer())
      .delete(`/api/v1/ticket-types/${newId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });
});