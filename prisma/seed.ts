import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial FMCG Booker test accounts...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Pending Booker (Waiting for admin approval)
  await prisma.user.upsert({
    where: { username: 'booker_karachi_01' },
    update: {},
    create: {
      username: 'booker_karachi_01',
      password: hashedPassword,
      role: 'booker',
      status: 'pending',
      deviceId: 'IMEI-864209041234567',
    },
  });

  // 2. Active Booker (Approved and device bound)
  await prisma.user.upsert({
    where: { username: 'booker_lahore_02' },
    update: {},
    create: {
      username: 'booker_lahore_02',
      password: hashedPassword,
      role: 'booker',
      status: 'active',
      deviceId: 'DEVICE-SAMSUNG-S23-A99B',
    },
  });

  // 3. Active Booker (Unbound - will bind on first login)
  await prisma.user.upsert({
    where: { username: 'booker_islamabad_03' },
    update: {},
    create: {
      username: 'booker_islamabad_03',
      password: hashedPassword,
      role: 'booker',
      status: 'active',
      deviceId: null,
    },
  });

  // 4. Blocked Booker (Access denied)
  await prisma.user.upsert({
    where: { username: 'booker_peshawar_04' },
    update: {},
    create: {
      username: 'booker_peshawar_04',
      password: hashedPassword,
      role: 'booker',
      status: 'blocked',
      deviceId: 'IMEI-991122334455667',
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
