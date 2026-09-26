const request = require('supertest');
const app = require('../src/app');
const { resetDb, prisma } = require('./setup');

beforeEach(resetDb);
afterAll(async () => prisma.$disconnect());

describe('Auth', () => {
  const user = { email: 'jane@example.com', password: 'secret123', name: 'Jane' };

  it('signs up a new user and returns a token', async () => {
    const res = await request(app).post('/auth/signup').send(user);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects duplicate signup emails', async () => {
    await request(app).post('/auth/signup').send(user);
    const res = await request(app).post('/auth/signup').send(user);
    expect(res.status).toBe(409);
  });

  it('rejects invalid signup payloads', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: '123', name: '' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/auth/signup').send(user);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await request(app).post('/auth/signup').send(user);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('blocks access to protected routes without a token', async () => {
    const res = await request(app).get('/bookings');
    expect(res.status).toBe(401);
  });
});
