/**
 * Create Admin User
 *
 * Creates an admin user with a working password for Better Auth.
 *
 * Usage: node prisma/create-admin.js
 */

import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Better Auth uses scrypt for password hashing
// Format: hash:salt
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return hash + ':' + salt;
}

async function createAdmin() {
  const userId = 'admin-user-001';
  const email = 'admin@violetteer.com';
  const password = 'adminadmin';

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists, deleting and recreating...');
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.listPlant.deleteMany({ where: { list: { userId: existing.id } } });
    await prisma.list.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      id: userId,
      email,
      name: 'Admin',
      emailVerified: true,
      isAdmin: true,
    }
  });

  // Create account with hashed password
  await prisma.account.create({
    data: {
      id: 'admin-account-001',
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: hashPassword(password),
    }
  });

  // Create default lists
  await prisma.list.createMany({
    data: [
      { userId: user.id, name: 'My Collection', color: '#4CAF50', isDefault: true },
      { userId: user.id, name: 'Wishlist', color: '#E91E63', isDefault: true },
    ]
  });

  console.log('✓ Created admin user:');
  console.log('  Email: admin@violetteer.com');
  console.log('  Password: adminadmin');
  console.log('  isAdmin: true');
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
