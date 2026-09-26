
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const apollo = await prisma.centre.create({
    data: {
      name: 'Apollo Diagnostics',
      location: 'Pune, MH',
      tests: {
        create: [
          { name: 'Complete Blood Count (CBC)', price: 350.0 },
          { name: 'Lipid Profile', price: 700.0 },
        ],
      },
    },
  });

  const lifeline = await prisma.centre.create({
    data: {
      name: 'Lifeline Labs',
      location: 'Mumbai, MH',
      tests: {
        create: [
          { name: 'Thyroid Profile (T3 T4 TSH)', price: 550.0 },
          { name: 'HbA1c', price: 450.0 },
        ],
      },
    },
  });

  console.log('Seeded centres:', apollo.name, lifeline.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
