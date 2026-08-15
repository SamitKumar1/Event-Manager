import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role, OrganizationRole } from '@prisma/client';

describe('EventsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let orgId: string;

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
      data: {
        name: 'Owner User',
        email: `owner_${unique}@example.com`,
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: 'test-password' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    // Admin user
    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: `admin_${unique}@example.com`,
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'test-password' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    // Member user
    const member = await prisma.user.create({
      data: {
        name: 'Member User',
        email: `member_${unique}@example.com`,
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    const memberLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: member.email, password: 'test-password' })
      .expect(200);
    memberToken = memberLogin.body.accessToken;

    // Create organization with owner as OWNER, admin as ADMIN, member as MEMBER
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org',
        slug: `test-org-${unique}`,
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
  });

  afterAll(async () => {
    await app.close();
  });

  let createdEventId: string;

  it('POST /organizations/:orgId/events - owner can create', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Event 1',
        slug: 'event-1',
        locationType: 'PHYSICAL',
        venueName: 'Hall',
        address: '123 St',
        city: 'City',
        country: 'Country',
        startAt: '2025-10-10T10:00:00Z',
        endAt: '2025-10-10T12:00:00Z',
        timezone: 'UTC',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        createdEventId = res.body.id;
        expect(res.body.status).toBe('DRAFT');
      });
  });

  it('POST /organizations/:orgId/events - member cannot create', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Event 2',
        slug: 'event-2',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        startAt: '2025-10-10T10:00:00Z',
        endAt: '2025-10-10T12:00:00Z',
        timezone: 'UTC',
      })
      .expect(403);
  });

  it('GET /organizations/:orgId/events - member can list', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/events`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.items.length).toBeGreaterThan(0);
      });
  });

  it('GET /events/org/:id - member can view', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/events/org/${createdEventId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(createdEventId);
      });
  });

  it('PATCH /organizations/:orgId/events/:id - admin can update', () => {
    return request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/events/${createdEventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title' })
      .expect(200)
      .expect((res) => {
        expect(res.body.title).toBe('Updated Title');
      });
  });

  it('PATCH /organizations/:orgId/events/:id - member cannot update', () => {
    return request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/events/${createdEventId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hack' })
      .expect(403);
  });

  it('POST /organizations/:orgId/events/:id/publish - owner can publish', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events/${createdEventId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('PUBLISHED');
      });
  });

  it('POST /organizations/:orgId/events/:id/cancel - admin can cancel published', async () => {
    // create another event draft then publish then cancel
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Event to Cancel',
        slug: 'event-cancel',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        startAt: '2025-11-11T10:00:00Z',
        endAt: '2025-11-11T12:00:00Z',
        timezone: 'UTC',
      })
      .expect(201);
    const evId = createRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events/${evId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    return request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events/${evId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('CANCELLED');
      });
  });

  it('DELETE /organizations/:orgId/events/:id - owner can delete draft only', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Draft to Delete',
        slug: 'draft-delete',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        startAt: '2025-12-12T10:00:00Z',
        endAt: '2025-12-12T12:00:00Z',
        timezone: 'UTC',
      })
      .expect(201);
    const evId = createRes.body.id;
    return request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgId}/events/${evId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('DELETE /organizations/:orgId/events/:id - cannot delete published', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Published No Delete',
        slug: 'pub-no-delete',
        locationType: 'ONLINE',
        venueName: 'Zoom',
        startAt: '2025-12-13T10:00:00Z',
        endAt: '2025-12-13T12:00:00Z',
        timezone: 'UTC',
      })
      .expect(201);
    const evId = createRes.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/events/${evId}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    return request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgId}/events/${evId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);
  });
});