const request = require('supertest');
const app = require('../src/app');
const { resetDb, prisma } = require('./setup');

beforeEach(resetDb);
afterAll(async () => prisma.$disconnect());

async function signupAndLogin(email = 'bob@example.com') {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: 'secret123', name: 'Bob' });
  return res.body.token;
}

async function seedCentreWithTest() {
  const centre = await prisma.centre.create({
    data: {
      name: 'Test Centre',
      location: 'Pune',
      tests: { create: [{ name: 'CBC', price: 300 }] },
    },
    include: { tests: true },
  });
  return { centre, test: centre.tests[0] };
}

describe('Bookings', () => {
  it('creates a booking for an authenticated user', async () => {
    const token = await signupAndLogin();
    const { test } = await seedCentreWithTest();

    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: test.id, appointmentAt: new Date(Date.now() + 86400000).toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(Number(res.body.amount)).toBe(300);
  });

  it('rejects booking a non-existent test', async () => {
    const token = await signupAndLogin();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: '00000000-0000-0000-0000-000000000000', appointmentAt: new Date().toISOString() });
    expect(res.status).toBe(404);
  });

  it('prevents one user from viewing another user\'s booking', async () => {
    const tokenA = await signupAndLogin('a@example.com');
    const tokenB = await signupAndLogin('b@example.com');
    const { test } = await seedCentreWithTest();

    const created = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ testId: test.id, appointmentAt: new Date(Date.now() + 86400000).toISOString() });

    const res = await request(app)
      .get(`/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });

  it('pays for a booking and confirms it on SUCCESS', async () => {
    const token = await signupAndLogin();
    const { test } = await seedCentreWithTest();

    const booking = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: test.id, appointmentAt: new Date(Date.now() + 86400000).toISOString() });

    const payment = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.body.id, simulate: 'SUCCESS' });

    expect(payment.status).toBe(201);
    expect(payment.body.payment.status).toBe('SUCCESS');
    expect(payment.body.booking.status).toBe('CONFIRMED');
  });

  it('marks a booking FAILED when the simulated payment fails', async () => {
    const token = await signupAndLogin();
    const { test } = await seedCentreWithTest();

    const booking = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: test.id, appointmentAt: new Date(Date.now() + 86400000).toISOString() });

    const payment = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.body.id, simulate: 'FAILED' });

    expect(payment.body.payment.status).toBe('FAILED');
    expect(payment.body.booking.status).toBe('FAILED');
  });

  it('does not charge a booking twice', async () => {
    const token = await signupAndLogin();
    const { test } = await seedCentreWithTest();

    const booking = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: test.id, appointmentAt: new Date(Date.now() + 86400000).toISOString() });

    await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.body.id, simulate: 'SUCCESS' });

    const second = await request(app)
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.body.id, simulate: 'SUCCESS' });

    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    const paymentCount = await prisma.payment.count({ where: { bookingId: booking.body.id } });
    expect(paymentCount).toBe(1);
  });

  it('cancels a PENDING booking but not a CONFIRMED one', async () => {
    const token = await signupAndLogin();
    const { test } = await seedCentreWithTest();

    const booking = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: test.id, appointmentAt: new Date(Date.now() + 86400000).toISOString() });

    const cancelled = await request(app)
      .post(`/bookings/${booking.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const second = await request(app)
      .post(`/bookings/${booking.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(400); 
  });
});
