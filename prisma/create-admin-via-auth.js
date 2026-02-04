/**
 * Create Admin User via Better Auth API
 *
 * This uses Better Auth's internal methods to properly hash the password.
 */

import { PrismaClient } from '@prisma/client';
import { auth } from '../server/lib/auth.js';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@violetteer.com';
  const password = 'adminadmin';
  const name = 'Admin';

  // Delete existing admin user if present
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Deleting existing admin user...');
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.listPlant.deleteMany({ where: { list: { userId: existing.id } } });
    await prisma.list.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Use Better Auth's API to create the user properly
  // This ensures the password is hashed correctly
  const response = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name,
    },
  });

  if (response.user) {
    // Update the user to be an admin
    await prisma.user.update({
      where: { id: response.user.id },
      data: { isAdmin: true },
    });

    console.log('✓ Created admin user:');
    console.log('  Email: admin@violetteer.com');
    console.log('  Password: adminadmin');
    console.log('  isAdmin: true');
  } else {
    console.error('Failed to create user:', response);
  }
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
