import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plants = await prisma.plant.findMany();
  console.log('Plants:', plants);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());