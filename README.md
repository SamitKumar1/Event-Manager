# Event Platform

A full‑stack event management platform built with **NestJS** (backend) and **React + Vite** (frontend).  
It supports user authentication with JWT + RBAC, organization & event management, ticket types, reservations, orders, payments (mock provider), QR‑based check‑in, real‑time notifications, and analytics.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Overview](#api-overview)
- [Authentication & Roles](#authentication--roles)
- [Implemented vs Planned Features](#implemented-vs-planned-features)

---

## Project Overview
Event Platform enables organizers to create and manage events, define ticket types, and sell tickets. Attendees can browse events, reserve tickets, complete a checkout flow, receive QR‑coded tickets, and check‑in at the venue. The system also exposes real‑time updates via WebSockets and provides basic analytics for organizers.

---

## Key Features
| Area | Implemented |
|------|-------------|
| **Auth** | JWT access tokens, bcrypt password hashing, role‑based guards (`ATTENDEE`, `ORGANIZER`, `ADMIN`) |
| **Organizations** | CRUD, member invitation, role hierarchy (`OWNER`, `ADMIN`, `MEMBER`) |
| **Events** | Full lifecycle (draft → published → cancelled/completed), location types (physical/online/hybrid), slug‑based public URLs |
| **Ticket Types** | Price, quantity, sales window, per‑event uniqueness |
| **Reservations** | Temporary holds with expiry, concurrency‑safe via Redis lock |
| **Orders & Payments** | Order creation, idempotent payment records, mock payment provider (success/failure simulation) |
| **Tickets** | QR‑code token, unique ticket code, status flow (`VALID` → `USED`/`CANCELLED`) |
| **Check‑in** | QR validation, realtime broadcast of check‑in events |
| **Notifications** | In‑app notification store, unread badge |
| **Analytics** | Sales & check‑in aggregates per event |
| **Real‑time** | Socket.io gateway for live updates (reservations, check‑ins) |
| **Background Jobs** | Scheduled expiration of stale reservations (`@nestjs/schedule`) |
| **Email** | Pluggable provider (mock implementation for dev) |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router, Axios, protected routes, organizer dashboard, analytics charts |

---

## Architecture
```
┌─────────────┐          HTTP/WS          ┌─────────────┐
│   React     │ ◄──────────────────────► │   NestJS    │
│  (Frontend) │   REST + Socket.io       │  (Backend)  │
└──────┬──────┘                           └──────┬──────┘
       │                                          │
       │                                          │
       ▼                                          ▼
┌─────────────┐                           ┌─────────────┐
│  Browser    │                           │  PostgreSQL │
│  (State)    │                           │  (Prisma)   │
└─────────────┘                           └──────┬──────┘
                                                  │
                                                  ▼
                                           ┌─────────────┐
                                           │    Redis    │
                                           │ (Locks, Pub)│
                                           └─────────────┘
```
* **Backend** – Modular NestJS app; each domain lives in `src/modules/<domain>`.
* **Database** – PostgreSQL, accessed via Prisma Client (generated from `backend/prisma/schema.prisma`).
* **Cache / Locks** – Redis (ioredis) for reservation locking and pub/sub.
* **Real‑time** – Socket.io server mounted on the same HTTP port.
* **Frontend** – SPA built with Vite, communicates with backend via Axios (REST) and Socket.io client.

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict) |
| Backend | NestJS 10, @nestjs/jwt, @nestjs/passport, @nestjs/websockets, @nestjs/schedule |
| ORM | Prisma 5 (PostgreSQL) |
| Validation | class‑validator + class‑transformer, Joi for config |
| Auth | Passport‑JWT, bcrypt |
| Real‑time | Socket.io 4 |
| Task Scheduling | @nestjs/schedule (cron) |
| Frontend | React 18, Vite 5, React Router 7, Tailwind CSS 4 |
| State / Data Fetching | React Context + Axios |
| Testing | Jest (unit + e2e), Supertest |
| Lint / Format | ESLint + Prettier (both repos) |
| Containerisation | Docker Compose (Postgres 16, Redis 7) |
| CI‑ready scripts | `npm run lint`, `npm run test`, `npm run build` |

---

## Folder Structure
```
event-platform/
├─ backend/                     # NestJS application
│  ├─ prisma/
│  │   └─ schema.prisma        # DB models & enums
│  ├─ src/
│  │   ├─ common/               # Guards, decorators, pipes, filters, Redis
│  │   ├─ config/               # ConfigModule + Joi validation
│  │   ├─ health/               # /health endpoint
│  │   ├─ modules/              # Feature modules (auth, organizations, events, ticketing, …)
│  │   ├─ app.module.ts
│  │   └─ main.ts
│  ├─ test/                     # e2e tests
│  ├─ package.json
│  └─ .env.example
├─ frontend/                    # React + Vite SPA
│  ├─ src/
│  │   ├─ api/                  # Axios client + endpoint constants
│  │   ├─ components/           # Shared UI (Layout, Header)
│  │   ├─ context/              # AuthContext (JWT storage, user)
│  │   ├─ pages/                # Route components (Login, Dashboard, Events, Checkout, …)
│  │   ├─ routes/               # Route definitions + guards
│  │   ├─ types/                # TS interfaces mirroring backend DTOs
│  │   ├─ App.tsx
│  │   └─ main.tsx
│  ├─ package.json
│  └─ .env.example
├─ infrastructure/
│  └─ docker-compose.yml        # Postgres + Redis
├─ package.json                 # Root (only dev deps for shared tooling)
└─ README.md
```

---

## Prerequisites
* Node.js ≥ 20
* pnpm / npm / yarn (repo uses npm)
* Docker & Docker Compose (for DB & Redis)
* Git

---

## Environment Variables
Create the following files from the provided examples:

| File | Required variables | Description |
|------|-------------------|-------------|
| `backend/.env` (copy from `backend/.env.example`) | `PORT`, `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `MOCK_EMAIL_FORCE_FAIL` | Backend runtime config |
| `frontend/.env` (copy from `frontend/.env.example`) | `VITE_API_BASE_URL` (e.g. `http://localhost:3000/api/v1`) | Frontend API base |
| `infrastructure/.env` (copy from `infrastructure/.env.example`) | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker Compose DB credentials |

**Example `backend/.env`**
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://event_user:event_pass@localhost:5432/event_platform?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=super-secret-change-me
JWT_EXPIRES_IN=15m
MOCK_EMAIL_FORCE_FAIL=false
```

**Example `infrastructure/.env`**
```env
POSTGRES_USER=event_user
POSTGRES_PASSWORD=event_pass
POSTGRES_DB=event_platform
```

---

## Database Setup
1. Start the containers  
   ```bash
   cd infrastructure
   docker compose up -d
   ```
2. Generate Prisma client & run migrations (from `backend/`)  
   ```bash
   cd ../backend
   npm run prisma:generate
   npm run prisma:migrate:dev   # creates tables & seeds dev data if any
   ```
   *For production:* `npm run prisma:migrate:deploy`.

---

## Installation
```bash
# 1. Clone
git clone <repo-url>
cd event-platform

# 2. Install backend deps
cd backend
npm ci

# 3. Install frontend deps
cd ../frontend
npm ci
```

---

## Running the Application
### Development (watch mode)

**Terminal 1 – Backend**
```bash
cd backend
npm run start:dev      # http://localhost:3000
```

**Terminal 2 – Frontend**
```bash
cd frontend
npm run dev            # http://localhost:5173 (Vite default)
```

The frontend proxies API calls to `VITE_API_BASE_URL` (default `http://localhost:3000/api/v1`).

### Production build
```bash
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build          # outputs to frontend/dist
# Serve `dist/` with any static server (nginx, Vercel, etc.)
```

---

## Testing
```bash
# Backend unit + e2e
cd backend
npm run test           # unit (jest)
npm run test:e2e       # e2e (supertest against running app)

# Frontend (if tests added)
cd frontend
npm run test           # (currently no test script configured)
```

Lint & format:
```bash
npm run lint   # both backend & frontend have their own lint scripts
npm run format
```

---

## API Overview (REST)
All endpoints are prefixed with `/api/v1` (configured in `backend/src/main.ts`).  
Authentication: `Authorization: Bearer <jwt>`.

| Module | Main Routes | Access |
|--------|-------------|--------|
| **Auth** | `POST /auth/register`, `POST /auth/login` | Public |
| **Organizations** | `POST /organizations`, `GET /organizations/:id`, `PATCH /organizations/:id`, `POST /organizations/:id/members`, `PATCH /organizations/:id/members/:userId` | Org members (role‑guarded) |
| **Events** | `POST /organizations/:orgId/events`, `GET /events`, `GET /events/:id`, `PATCH /events/:id`, `DELETE /events/:id` | Organizer/Admin for write; public read for published |
| **Ticket Types** | `POST /events/:eventId/ticket-types`, `GET /events/:eventId/ticket-types`, `PATCH /ticket-types/:id` | Organizer/Admin |
| **Reservations** | `POST /reservations`, `GET /reservations/:id`, `DELETE /reservations/:id` | Authenticated attendee |
| **Orders** | `POST /orders`, `GET /orders/:id`, `GET /orders` | Authenticated attendee |
| **Payments** | `POST /payments`, `GET /payments/:id` | Authenticated attendee (mock provider) |
| **Tickets** | `GET /tickets`, `GET /tickets/:id`, `POST /checkin` | Attendee (own), Organizer (check‑in) |
| **Notifications** | `GET /notifications`, `PATCH /notifications/:id/read` | Authenticated |
| **Analytics** | `GET /analytics/events/:eventId` | Organizer/Admin |
| **Health** | `GET /health` | Public |

*WebSocket* – Connect to `ws://localhost:3000` (Socket.io) with the same JWT in `auth` handshake to receive `reservation:updated`, `checkin:created`, etc.

---

## Authentication & Roles
| Role | Scope |
|------|-------|
| **ATTENDEE** (default) | Browse events, reserve & purchase tickets, view own tickets, check‑in |
| **ORGANIZER** | Create/manage events & ticket types inside owned organizations, view analytics, check‑in attendees |
| **ADMIN** | Full platform access (future global admin panel) |

*Implementation details* – `JwtAuthGuard` validates the JWT and attaches `request.user = { sub, email, role }`. `RolesGuard` reads `@Roles(...)` decorator (via `ROLES_KEY`) and permits only listed `Role` enum values. Organization‑level permissions are enforced by `OrgMembershipGuard` + `OrgRolesGuard` checking `OrganizationMember.role`.

---

## Implemented vs Planned Features
| Feature | Status |
|---------|--------|
| User registration & login (JWT) | ✅ |
| Role‑based access control (global + org) | ✅ |
| Organization CRUD & member management | ✅ |
| Event lifecycle & slug‑based public pages | ✅ |
| Ticket type definition, pricing, sales windows | ✅ |
| Reservation hold with Redis lock & auto‑expiry | ✅ |
| Order creation, idempotent payment record, mock provider | ✅ |
| QR‑coded tickets, unique ticket code, status flow | ✅ |
| Check‑in endpoint + realtime broadcast | ✅ |
| In‑app notifications (read/unread) | ✅ |
| Organizer dashboard (events, ticket types, analytics) | ✅ |
| Real‑time updates via Socket.io | ✅ |
| Background job for reservation expiration | ✅ |
| Email sending (mock provider) | ✅ |
| Automated test suite (unit + e2e) | ✅ |
| **Planned / Not Yet Implemented** |
| Production‑grade payment gateway (Stripe, PayPal) | 🔲 |
| Email templates & real SMTP provider | 🔲 |
| Admin panel (user/org oversight) | 🔲 |
| Multi‑language / i18n | 🔲 |
| Advanced analytics (charts, export) | 🔲 |
| Mobile app / PWA | 🔲 |
| CI/CD pipeline (GitHub Actions) | 🔲 |

---
