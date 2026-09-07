import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let attendeeToken: string;
  let organizerToken: string;
  let adminToken: string;
  const unique = Date.now(); // Shared timestamp for test data isolation

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

    // Organizer user
    const organizer = await prisma.user.create({
      data: {
        name: 'Organizer User',
        email: `organizer_${unique}@example.com`,
        passwordHash,
        role: Role.ORGANIZER,
      },
    });
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
  });

  afterAll(async () => {
    // Cleanup test data
    const unique = Date.now();
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `attendee_${unique}`,
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `organizer_${unique}`,
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: `admin_${unique}`,
        },
      },
    });
    await app.close();
  });

  const uniqueSuffix = Date.now();
  const validRegister = {
    name: 'Jane Doe',
    email: `jane_${uniqueSuffix}@example.com`,
    password: 'secure-password',
  };

  let healthUserId: string;
  let healthToken: string;

  it('/api/v1/auth/register (POST) - should register a new user', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validRegister)
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe(validRegister.name);
        expect(res.body.email).toBe(validRegister.email);
        expect(res.body.role).toBe('ATTENDEE');
        expect(res.body).toHaveProperty('createdAt');
        expect(res.body).not.toHaveProperty('passwordHash');
      });
  });

  it('/api/v1/auth/register (POST) - should reject duplicate email', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validRegister)
      .expect(409)
      .expect((res) => {
        expect(res.body.statusCode).toBe(409);
        expect(res.body.message).toBe('Email already registered');
      });
  });

  it('/api/v1/auth/register (POST) - should reject invalid payload', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: '', email: 'invalid', password: 'short' })
      .expect(400);
  });

  // LOGIN E2E TESTS
  const loginUser = {
    name: 'Login User',
    email: `login_${uniqueSuffix}@example.com`,
    password: 'login-password',
  };

  it('/api/v1/auth/login (POST) - should login successfully', async () => {
    // register user first
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(loginUser)
      .expect(201);

    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: loginUser.email, password: loginUser.password })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('accessToken');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('name', loginUser.name);
        expect(res.body.user).toHaveProperty('email', loginUser.email);
        expect(res.body.user).toHaveProperty('role', 'ATTENDEE');
        expect(res.body.user).not.toHaveProperty('passwordHash');
      });
  });

  it('/api/v1/auth/login (POST) - should reject wrong password', async () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: loginUser.email, password: 'wrong-password' })
      .expect(401);
  });

  it('/api/v1/auth/login (POST) - should reject unknown email', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `unknown_${uniqueSuffix}@example.com`, password: 'any' })
      .expect(401);
  });

  it('/api/v1/auth/login (POST) - should reject invalid payload', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'invalid', password: '' })
      .expect(400);
  });

  // HEALTH ENDPOINT TESTS
  it('/api/v1/health (GET) - public endpoint should return 200', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
      });
  });

  it('/api/v1/health/protected (GET) - without Authorization header should return 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/protected')
      .expect(401);
  });

  it('/api/v1/health/protected (GET) - with invalid token should return 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/protected')
      .set('Authorization', 'Bearer invalid.token')
      .expect(401);
  });

  it('/api/v1/health/protected (GET) - with valid ATTENDEE token should return 200 and user info', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/protected')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('message', 'Authenticated');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('role', 'ATTENDEE');
      });
  });

  // ADMIN ENDPOINT TESTS
  it('/api/v1/health/admin (GET) - without Authorization header should return 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/admin')
      .expect(401);
  });

  it('/api/v1/health/admin (GET) - with invalid token should return 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/admin')
      .set('Authorization', 'Bearer invalid.token')
      .expect(401);
  });

  it('/api/v1/health/admin (GET) - with ATTENDEE token should return 403', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/admin')
      .set('Authorization', `Bearer ${attendeeToken}`)
      .expect(403);
  });

  it('/api/v1/health/admin (GET) - with ORGANIZER token should return 403', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/admin')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(403);
  });

  it('/api/v1/health/admin (GET) - with ADMIN token should return 200 and admin info', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('message', 'Admin access granted');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user).toHaveProperty('role', 'ADMIN');
      });
  });
});