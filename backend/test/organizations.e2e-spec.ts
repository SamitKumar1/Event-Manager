import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

const testUnique = Date.now();

describe('OrganizationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizerToken: string;
  let adminToken: string;
  let attendeeToken: string;
  let organizerEmail: string;

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

    // Organizer user
    const organizer = await prisma.user.create({
      data: {
        name: 'Organizer User',
        email: `organizer_${unique}@example.com`,
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
    organizerEmail = organizer.email;
    const organizerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: organizer.email, password: 'test-password' })
      .expect(200);
    organizerToken = organizerLogin.body.accessToken;

    // Admin user
    const admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: `admin_${unique}@example.com`,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin.email, password: 'test-password' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    // Attendee user
    const attendee = await prisma.user.create({
      data: {
        name: 'Attendee User',
        email: `attendee_${unique}@example.com`,
        passwordHash,
        role: Role.ATTENDEE,
      },
    });
    const attendeeLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: attendee.email, password: 'test-password' })
      .expect(200);
    attendeeToken = attendeeLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/organizations - attendee cannot create', () => {
    return request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .send({ name: 'Test Org', slug: 'test-org' })
      .expect(403);
  });

  it('POST /api/v1/organizations - organizer can create', () => {
    return request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Test Org', slug: `test-org-1-${testUnique}` })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Test Org');
        expect(res.body.slug).toBe(`test-org-1-${testUnique}`);
      });
  });

  it('POST /api/v1/organizations - duplicate slug fails', () => {
    return request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Test Org 2', slug: `test-org-1-${testUnique}` })
      .expect(409);
  });

  it('GET /api/v1/organizations - list user orgs', () => {
    return request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('items');
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items.length).toBeGreaterThan(0);
      });
  });

  let createdOrgId: string;

  it('GET /api/v1/organizations/:id - get org details', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);
    createdOrgId = list.body.items[0].id;

    return request(app.getHttpServer())
      .get(`/api/v1/organizations/${createdOrgId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(createdOrgId);
        expect(res.body).toHaveProperty('members');
      });
  });

  it('PATCH /api/v1/organizations/:id - organizer (owner) can update', () => {
    return request(app.getHttpServer())
      .patch(`/api/v1/organizations/${createdOrgId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ name: 'Updated Org' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Updated Org');
      });
  });

  it('DELETE /api/v1/organizations/:id - owner can delete', () => {
    return request(app.getHttpServer())
      .delete(`/api/v1/organizations/${createdOrgId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toBe('Organization deleted');
      });
  });

  // Member tests: create new org for member ops
  let orgForMembersId: string;

  it('POST /api/v1/organizations - admin creates org for member tests', () => {
    return request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Member Test Org', slug: `member-test-org-${testUnique}` })
      .expect(201)
      .expect((res) => {
        orgForMembersId = res.body.id;
      });
  });

  it('POST /api/v1/organizations/:id/members - owner can add member', () => {
    return request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgForMembersId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: organizerEmail, role: 'MEMBER' })
      .expect(201);
  });

  it('GET /api/v1/organizations/:id/members - list members', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgForMembersId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('items');
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });
});