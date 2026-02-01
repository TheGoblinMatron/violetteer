import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Habit mapping
const habitMap = {
  '1': 'Standard',
  '2': 'Semiminiature',
  '3': 'Miniature',
  '4': 'Large',
  '5': 'Small Standard',
  '6': 'Trailer',
  '7': 'Standard Trailer',
  '8': 'Semiminiature Trailer',
  '9': 'Miniature Trailer',
  '10': 'Saintpaulia species'
};

async function main() {
  // Clear existing data (in correct order due to foreign keys)
  await prisma.review.deleteMany();
  await prisma.plantPhoto.deleteMany();
  await prisma.listPlant.deleteMany();
  await prisma.list.deleteMany();
  await prisma.plant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  /**
   * CREATE DEMO USER
   *
   * For development/testing, we create a demo user directly in the database.
   * In production, users would register through the auth flow.
   *
   * NOTE: We're NOT setting a password here because Better Auth manages
   * password hashing through its Account table. This demo user is just
   * for seeding data - you'll create a real account through the UI.
   */
  const demoUser = await prisma.user.create({
    data: {
      id: 'demo-user-001',  // Fixed ID for predictability in development
      email: 'demo@violetteer.com',
      name: 'Demo User',
      emailVerified: true,
      isAdmin: true,  // Demo user is an admin for testing
    }
  });

  console.log(`Created demo user: ${demoUser.email}`);

  // Create default lists FOR THE DEMO USER
  // Note: userId is now required - every list belongs to a user
  const myCollectionList = await prisma.list.create({
    data: {
      userId: demoUser.id,  // Link to the demo user
      name: 'My Collection',
      description: 'Plants I own',
      color: '#4caf50',
      isDefault: true,
      isPublic: false
    }
  });

  const wishlistList = await prisma.list.create({
    data: {
      userId: demoUser.id,  // Link to the demo user
      name: 'Wishlist',
      description: 'Plants I want to acquire',
      color: '#2196f3',
      isDefault: true,
      isPublic: false
    }
  });

  // Add fictional African violets
  const plants = await Promise.all([
    prisma.plant.create({
      data: {
        recNum: 1,
        name: 'Moonlight Serenade',
        hybridizer: 'J. Martinez',
        habit: habitMap['1'],
        regNum: '10234',
        regDate: '2015-03-15',
        blossom: 'Double white star with pale blue center.',
        foliage: 'Medium green, plain, quilted.',
        vintage: '2015',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464170/african-violets/wusp0r7qmypjkw3ah1zb.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 2,
        name: 'Berry Burst',
        hybridizer: 'S. Chen',
        habit: habitMap['2'],
        regNum: '11456',
        regDate: '2018-06-22',
        blossom: 'Semidouble raspberry-red frilled star with white edge.',
        foliage: 'Dark green, plain, pointed/red back.',
        vintage: '2018',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464094/african-violets/atws0renxlgpwcziz7wb.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 3,
        name: 'Lavender Dreams',
        hybridizer: 'R. Thompson',
        habit: habitMap['3'],
        regNum: '9877',
        regDate: '2012-11-08',
        blossom: 'Single lavender bell with darker veining.',
        foliage: 'Variegated light green and white, plain.',
        vintage: '2012',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464452/african-violets/sm1gxhpxvjblubfsktks.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 4,
        name: 'Purple Majesty',
        hybridizer: 'D. Williams',
        habit: habitMap['4'],
        regNum: '10567',
        regDate: '2016-02-14',
        blossom: 'Double dark purple ruffled star.',
        foliage: 'Dark green, quilted, heart-shaped.',
        altReg: 'Western 2016',
        vintage: '2016',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464816/african-violets/znpva73lu0hjptxlp2mn.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 5,
        name: 'Coral Sunset',
        hybridizer: 'M. Anderson',
        habit: habitMap['1'],
        regNum: '11234',
        regDate: '2017-09-30',
        blossom: 'Semidouble coral-pink star with yellow undertones.',
        foliage: 'Medium green, plain, serrated.',
        vintage: '2017',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769463863/african-violets/okdc73qohcuprd03fql9.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 6,
        name: 'Midnight Fantasy',
        hybridizer: 'K. Petrov',
        habit: habitMap['1'],
        regNum: '10789',
        regDate: '2016-07-19',
        blossom: 'Double dark blue-purple star with pink fantasy.',
        foliage: 'Dark green, plain, quilted/red back.',
        vintage: '2016',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464568/african-violets/ahlwfwxkkrtwadfk1cex.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 7,
        name: 'Tiny Treasure',
        hybridizer: 'L. Kim',
        habit: habitMap['3'],
        regNum: '11678',
        regDate: '2019-04-12',
        blossom: 'Single pink star.',
        foliage: 'Medium green, plain, girl.',
        vintage: '2019',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465051/african-violets/u80icq68mymia4z2hyia.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 8,
        name: 'Waterfall Blues',
        hybridizer: 'P. Johnson',
        habit: habitMap['6'],
        regNum: '10123',
        regDate: '2014-12-03',
        blossom: 'Semidouble light blue frilled star.',
        foliage: 'Medium green, plain, quilted.',
        vintage: '2014',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465184/african-violets/tse9x7qtzjuzyapxkvdg.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 9,
        name: 'Crimson Velvet',
        hybridizer: 'T. Garcia',
        habit: habitMap['1'],
        regNum: '11890',
        regDate: '2020-01-25',
        blossom: 'Double deep red ruffled star with darker center.',
        foliage: 'Dark green, plain, pointed.',
        vintage: '2020',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464247/african-violets/tnwvnuzlwckbndwtpjzd.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 10,
        name: 'Snow Princess',
        hybridizer: 'A. Ivanova',
        habit: habitMap['2'],
        regNum: '9654',
        regDate: '2011-05-17',
        blossom: 'Double white frilled star with light pink blush.',
        foliage: 'Variegated medium green and white, plain, quilted.',
        vintage: '2011',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464938/african-violets/sm8g5iyzdruaitjx4dix.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 11,
        name: 'Plum Delight',
        hybridizer: 'N. Brown',
        habit: habitMap['5'],
        regNum: '10445',
        regDate: '2015-10-09',
        blossom: 'Semidouble plum-purple star with white edge.',
        foliage: 'Medium green, plain, heart-shaped.',
        vintage: '2015',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464721/african-violets/tqgjru6qtxfvzf51gsoq.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 12,
        name: 'Blueberry Muffin',
        hybridizer: 'E. Taylor',
        habit: habitMap['1'],
        regNum: '11567',
        regDate: '2018-11-20',
        blossom: 'Double medium blue ruffled star with darker blue fantasy.',
        foliage: 'Medium green, quilted, plain.',
        vintage: '2018',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769463920/african-violets/zeisnrcbscdlpaksxnkx.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 13,
        name: 'Pink Lemonade',
        hybridizer: 'C. O\'Brien',
        habit: habitMap['2'],
        regNum: '10998',
        regDate: '2017-03-28',
        blossom: 'Single-semidouble light pink star with yellow center.',
        foliage: 'Light green, plain, quilted.',
        vintage: '2017',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464677/african-violets/ih0pxhl79ygivjlvq711.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 14,
        name: 'Raspberry Ripple',
        hybridizer: 'H. Lee',
        habit: habitMap['7'],
        regNum: '11223',
        regDate: '2017-08-14',
        blossom: 'Semidouble pink and white chimera.',
        foliage: 'Medium green, plain, pointed.',
        vintage: '2017',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464876/african-violets/qiksavmu7aeoij8npr2m.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 15,
        name: 'Starry Night',
        hybridizer: 'V. Kowalski',
        habit: habitMap['1'],
        regNum: '10334',
        regDate: '2015-06-05',
        blossom: 'Double dark blue star with white fantasy.',
        foliage: 'Dark green, quilted, plain/red back.',
        vintage: '2015',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464993/african-violets/erzegl8uw8n2igtengm6.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 16,
        name: 'Little Gem',
        hybridizer: 'F. Murphy',
        habit: habitMap['3'],
        blossom: 'Single white star with pink blush.',
        foliage: 'Medium green, plain, girl.',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464501/african-violets/d7jwn749idgspawnuj3n.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 17,
        name: 'Violet Cascade',
        hybridizer: 'B. Yamamoto',
        habit: habitMap['8'],
        regNum: '11789',
        regDate: '2019-10-18',
        blossom: 'Semidouble violet-purple star.',
        foliage: 'Variegated dark green and pink, plain.',
        vintage: '2019',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465146/african-violets/v0p7kjrzunyn6phpfxdp.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 18,
        name: 'Peaches and Cream',
        hybridizer: 'G. Fischer',
        habit: habitMap['1'],
        regNum: '10656',
        regDate: '2016-04-22',
        blossom: 'Double peach-pink star with cream edge.',
        foliage: 'Medium green, plain, quilted.',
        vintage: '2016',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464624/african-violets/wb2tswzi3ty9huhyfhol.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 19,
        name: 'Emerald City',
        hybridizer: 'W. Zhang',
        habit: habitMap['2'],
        regNum: '11445',
        regDate: '2018-02-09',
        blossom: 'Semidouble white star with green ruffled edge.',
        foliage: 'Variegated medium green and white, quilted, serrated.',
        vintage: '2018',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769464409/african-violets/udgqd9a4qwkhrlpxahx4.jpg',
        isInCatalog: true
      }
    }),
    prisma.plant.create({
      data: {
        recNum: 20,
        name: 'Wild Rose',
        hybridizer: 'I. Silva',
        habit: habitMap['9'],
        regNum: '10876',
        regDate: '2016-09-12',
        blossom: 'Single rose-pink frilled star.',
        foliage: 'Light green, plain, pointed.',
        altReg: 'TX 2016',
        vintage: '2016',
        imageUrl: 'https://res.cloudinary.com/dq90ip4xn/image/upload/v1769465234/african-violets/th3xictcigfuxest0muj.jpg',
        isInCatalog: true
      }
    })
  ]);

  // Add some plants to My Collection
  await prisma.listPlant.create({
    data: {
      listId: myCollectionList.id,
      plantId: plants[0].id,
      notes: 'Bloomed beautifully last spring!'
    }
  });
  await prisma.listPlant.create({
    data: {
      listId: myCollectionList.id,
      plantId: plants[1].id,
      notes: 'Needs more light'
    }
  });
  await prisma.listPlant.create({
    data: {
      listId: myCollectionList.id,
      plantId: plants[4].id
    }
  });
  await prisma.listPlant.create({
    data: {
      listId: myCollectionList.id,
      plantId: plants[6].id
    }
  });
  await prisma.listPlant.create({
    data: {
      listId: myCollectionList.id,
      plantId: plants[11].id,
      notes: 'Gift from Mom, started from leaf cutting'
    }
  });

  // Add some plants to Wishlist
  await prisma.listPlant.create({
    data: {
      listId: wishlistList.id,
      plantId: plants[3].id
    }
  });
  await prisma.listPlant.create({
    data: {
      listId: wishlistList.id,
      plantId: plants[8].id
    }
  });
  await prisma.listPlant.create({
    data: {
      listId: wishlistList.id,
      plantId: plants[14].id
    }
  });

  console.log('Database seeded with lists, plants, and list entries!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });