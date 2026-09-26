const prisma = require('../src/config/prisma');

async function resetDb() {
  await prisma.webhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.test.deleteMany();
  await prisma.centre.deleteMany();
  await prisma.user.deleteMany();
}

module.exports = { resetDb, prisma };
