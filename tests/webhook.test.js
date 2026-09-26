const request = require('supertest');
const app = require('../src/app');
const { resetDb, prisma } = require('./setup');

beforeEach(resetDb);
afterAll(async () => prisma.$disconnect());

async function setupBooking() {
  const user = await request(app)
    .post('/auth/signup')
    .send({ email: 'webhook@example.com', password: 'secret123', name: 'W' });

  const centre = await prisma.centre.create({
    data: { name: 'WH Centre', location: 'Pune', tests: { create: [{ name: 'Test', price: 200 }] } },
    include: { tests: true },
  });

  const booking = await request(app)
    .post('/bookings')
    .set('Authorization', `Bearer ${user.body.token}`)
    .send({ testId: centre.tests[0].id, appointmentAt: new Date(Date.now() + 86400000).toISOString() });

  return booking.body;
}

describe('Payment webhook idempotency', () => {
  it('confirms a booking on a SUCCESS webhook', async () => {
    const booking = await setupBooking();

    const res = await request(app).post('/payments/webhook').send({
      eventId: 'evt_1',
      bookingId: booking.id,
      status: 'SUCCESS',
    });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CONFIRMED');
  });

  it('ignores a repeated delivery of the same eventId', async () => {
    const booking = await setupBooking();
    const payload = { eventId: 'evt_dup', bookingId: booking.id, status: 'SUCCESS' };

    const first = await request(app).post('/payments/webhook').send(payload);
    const second = await request(app).post('/payments/webhook').send(payload);
    const third = await request(app).post('/payments/webhook').send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(third.body.duplicate).toBe(true);

    // Exactly one payment must exist despite three deliveries.
    const paymentCount = await prisma.payment.count({ where: { bookingId: booking.id } });
    expect(paymentCount).toBe(1);

    const events = await prisma.webhookEvent.count({ where: { eventId: 'evt_dup' } });
    expect(events).toBe(1);
  });

  it('does not double-settle a booking even if the provider sends a different eventId for the same booking', async () => {
    const booking = await setupBooking();

    await request(app)
      .post('/payments/webhook')
      .send({ eventId: 'evt_a', bookingId: booking.id, status: 'SUCCESS' });

    const res = await request(app)
      .post('/payments/webhook')
      .send({ eventId: 'evt_b', bookingId: booking.id, status: 'FAILED' });

    expect(res.body.duplicate).toBe(true);
    expect(res.body.booking.status).toBe('CONFIRMED'); // unchanged from first event

    const paymentCount = await prisma.payment.count({ where: { bookingId: booking.id } });
    expect(paymentCount).toBe(1);
  });

  it('rejects a webhook for a non-existent booking', async () => {
    const res = await request(app).post('/payments/webhook').send({
      eventId: 'evt_missing',
      bookingId: '00000000-0000-0000-0000-000000000000',
      status: 'SUCCESS',
    });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed webhook payload', async () => {
    const res = await request(app).post('/payments/webhook').send({ eventId: 'evt_bad' });
    expect(res.status).toBe(400);
  });
});
