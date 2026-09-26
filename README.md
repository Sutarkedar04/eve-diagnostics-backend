# EVE Diagnostics — Booking & Simulated Payment API

A backend service for booking diagnostic tests and simulating payments, built with
**Node.js, Express, PostgreSQL and Prisma**.

## Stack

- Express (routing/middleware)
- PostgreSQL + Prisma ORM (schema, migrations, queries)
- JWT (`jsonwebtoken`) + `bcryptjs` for auth
- `zod` for request validation
- Jest + Supertest for tests

## 1. Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a connection string to a hosted instance)

## 2. Setup

```bash
git clone <your-repo-url>
cd eve-diagnostics-backend
npm install

cp .env.example .env
# then edit .env: set DATABASE_URL to your Postgres connection string,
# and set JWT_SECRET to any long random string

npx prisma migrate dev --name init   # creates tables from prisma/schema.prisma
npm run seed                         # optional: adds 2 demo centres + tests

npm run dev                          # starts the API on http://localhost:4000
```

## 3. Running tests

Tests run against a real Postgres database (no mocking of the DB layer), so
point `DATABASE_URL` at a **separate test database** before running them —
e.g. create `eve_diagnostics_test` and put its URL in `.env`, or export it
inline:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eve_diagnostics_test" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eve_diagnostics_test" npm test
```

Each test file wipes and reseeds the tables it needs (`tests/setup.js`), so
tests are isolated and can run in any order.

## 4. API Reference

All bodies are JSON. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint       | Auth | Body                                  |
|--------|----------------|------|----------------------------------------|
| POST   | `/auth/signup` | No   | `{ email, password, name }`            |
| POST   | `/auth/login`  | No   | `{ email, password }`                  |

```bash
curl -X POST localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"secret123","name":"Jane"}'
```

### Diagnostic Centres & Tests

| Method | Endpoint                | Auth | Body                       |
|--------|--------------------------|------|-----------------------------|
| GET    | `/centres`               | No   | —                           |
| GET    | `/centres/:id`           | No   | —                           |
| POST   | `/centres`               | Yes  | `{ name, location }`        |
| POST   | `/centres/:id/tests`     | Yes  | `{ name, price }`           |

### Bookings

| Method | Endpoint               | Auth | Body                                       |
|--------|-------------------------|------|---------------------------------------------|
| POST   | `/bookings`             | Yes  | `{ testId, appointmentAt (ISO datetime) }`  |
| GET    | `/bookings`             | Yes  | — (lists the caller's own bookings)          |
| GET    | `/bookings/:id`         | Yes  | — (403 if it's not your booking)             |
| POST   | `/bookings/:id/cancel`  | Yes  | — (only allowed while PENDING)               |

```bash
curl -X POST localhost:4000/bookings \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"testId":"<test-uuid>","appointmentAt":"2026-10-01T09:00:00.000Z"}'
```

### Payments

| Method | Endpoint            | Auth | Body                                           |
|--------|----------------------|------|--------------------------------------------------|
| POST   | `/payments`          | Yes  | `{ bookingId, simulate?: "SUCCESS"\|"FAILED" }`  |
| POST   | `/payments/webhook`  | No*  | `{ eventId, bookingId, status, reference? }`     |

\* Webhook calls skip user auth (a real provider isn't a logged-in user) but
are gated by an `X-Webhook-Secret` header if `WEBHOOK_SECRET` is set in `.env`.

`POST /payments` simulates a gateway call started by the user: if `simulate`
is omitted, the outcome is randomized (80% `SUCCESS`). `POST /payments/webhook`
simulates the provider pushing a status update asynchronously — this is the
endpoint whose idempotency is exercised in `tests/webhook.test.js`.

```bash
curl -X POST localhost:4000/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt_123","bookingId":"<booking-uuid>","status":"SUCCESS"}'
```

## 5. Database / Schema Design

```
User        (id, email*, password, name)
Centre      (id, name, location)
Test        (id, name, price, centreId -> Centre)
Booking     (id, userId -> User, testId -> Test, centreId -> Centre,
             appointmentAt, amount, status, createdAt, updatedAt)
Payment     (id, bookingId* -> Booking, amount, status, reference*)
WebhookEvent(id, eventId*, payload, processedAt)
```
(`*` = unique)

Key decisions:

- **`Payment.bookingId` is unique** — a booking can have at most one payment
  row, at the database level, not just in application logic. Combined with
  the webhook's transaction, this makes "no duplicate payments" a schema
  guarantee rather than a hope.
- **`WebhookEvent.eventId` is unique** and is written inside the same
  transaction as the payment/booking update it triggers. If the same
  `eventId` is replayed, the `INSERT` fails on the unique constraint, the
  transaction rolls back, and the handler returns `200 { duplicate: true }`
  without touching booking/payment state. This is the idempotency mechanism
  required by the assignment.
- **Booking amount is copied from `Test.price` at booking time** rather than
  looked up again at payment time, so a later price change on the test
  doesn't retroactively change what an existing booking is charged.
- **`BookingStatus`** — `PENDING → CONFIRMED | FAILED`, or `PENDING →
  CANCELLED`. Once a booking leaves `PENDING` it's immutable (cancel is
  rejected, a second payment attempt is short-circuited as `duplicate`).

## 6. Edge Cases Handled

- Invalid/missing JWT → `401`
- Malformed request bodies (via `zod`) → `400` with field-level errors
- Booking a non-existent test → `404`
- Viewing/cancelling someone else's booking → `403`
- Paying a booking that's already been paid → `200` with `duplicate: true`,
  no second `Payment` row created
- Cancelling a non-`PENDING` booking → `400`
- Webhook for a non-existent booking → `404`
- Webhook delivered more than once (same `eventId`) → idempotent no-op
- Webhook for a booking that was already settled via a *different* event or
  the direct `/payments` call → acknowledged without re-settling

## 7. Assumptions

- No role system — any authenticated user can create centres/tests. In a
  real product this would be an admin-only capability.
- The payment "gateway" is fully simulated in-process; no real HTTP call to
  an external provider is made, per the assignment's instructions.
- The webhook's shared-secret check is opt-in (only enforced if
  `WEBHOOK_SECRET` is set) so it can be exercised via `curl`/tests without
  extra setup, while still demonstrating how a real signature check would
  slot in.
- One test can only belong to one centre (matches "each centre ... the
  tests they offer").

## 8. What I'd Improve With More Time

- Role-based access control (admin vs patient) for centre/test management
- Idempotency key support on `POST /payments` itself (currently relies on
  the unique `bookingId` on `Payment`, which is sufficient but a client-
  supplied key would be more standard)
- Retry/backoff + a dead-letter table for webhook processing failures
- OpenAPI/Swagger spec generated from the zod schemas
- Docker + docker-compose for one-command local setup
- Pagination on `GET /centres` and `GET /bookings`
