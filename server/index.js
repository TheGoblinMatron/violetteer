import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { requireAuth, optionalAuth, requireAdmin } from './middleware/auth.js';
import { generateDescription } from './lib/plantDescription.js';
import { uploadAvatar, uploadImageVersions, deleteImage } from './lib/spaces.js';
import { randomUUID } from 'crypto';
import multer from 'multer';

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;

// Configure multer for handling file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * CORS CONFIGURATION
 *
 * For authentication to work, we need:
 * 1. credentials: true - Allows cookies to be sent cross-origin
 * 2. origin: explicit URL - Can't use '*' with credentials
 *
 * WHY THIS MATTERS:
 * - Your frontend runs on localhost:5173 (Vite)
 * - Your backend runs on localhost:3001 (Express)
 * - These are different "origins" (different ports)
 * - Browsers block cross-origin cookie sharing by default
 * - This config explicitly allows it for your frontend
 */
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

/**
 * BETTER AUTH ROUTES
 *
 * This mounts ALL authentication endpoints:
 * - POST /api/auth/sign-up/email - Register new user
 * - POST /api/auth/sign-in/email - Login with email/password
 * - POST /api/auth/sign-out - Logout (clears session)
 * - GET  /api/auth/get-session - Get current user's session
 *
 * The toNodeHandler() converts Better Auth's web-standard handler
 * to work with Express's request/response objects.
 *
 * For Express 5, we need to use the router.use() pattern
 * to properly mount a catch-all handler.
 */
/**
 * Rate-limit /api/auth/* to slow brute-force attempts at sign-in,
 * password-reset email enumeration, and verification-resend spam.
 *
 * 100 req / 15 min / IP is loose enough for active testing AND for
 * the frontend's get-session polling, while still hard-capping any
 * brute-force attempt at a reasonable rate. We can tighten with a
 * per-endpoint limit later (stricter on /sign-in than /get-session).
 *
 * trustProxy is read from app.set('trust proxy', ...) — currently
 * unset, so the limiter uses req.ip which is the direct connection.
 * When deploying behind a proxy (DO App Platform, nginx, etc.), set
 * `app.set('trust proxy', 1)` so the limiter sees the real client IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a few minutes.' },
});

const authHandler = toNodeHandler(auth);
app.use('/api/auth', authLimiter, (req, res, next) => {
  // Better Auth expects the path without the /api/auth prefix
  // but since we're mounting at /api/auth, the full URL is preserved
  authHandler(req, res);
});

// ===== USER PROFILES =====

/**
 * GET current user's profile
 *
 * Returns the full profile for the authenticated user.
 * Used by the Settings page to populate form fields.
 */
app.get('/api/users/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        displayName: true,
        bio: true,
        location: true,
        website: true,
        username: true,
        socialInstagram: true,
        socialFacebook: true,
        socialTwitter: true,
        profileIsPublic: true,
        showEmail: true,
        isAvsaMember: true,
        localClub: true,
        otherAffiliation: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE current user's profile
 *
 * Allows updating profile fields but NOT sensitive fields like email or isAdmin.
 */
app.put('/api/users/me', requireAuth, async (req, res) => {
  try {
    // Only allow updating these specific fields
    const allowedFields = [
      'displayName', 'bio', 'location', 'website', 'username',
      'socialInstagram', 'socialFacebook', 'socialTwitter',
      'profileIsPublic', 'showEmail',
      'isAvsaMember', 'localClub', 'otherAffiliation'
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Validate username format and uniqueness if being changed
    if (updateData.username !== undefined) {
      if (updateData.username) {
        // Validate format: lowercase alphanumeric and underscores only
        const usernameRegex = /^[a-z0-9_]+$/;
        if (!usernameRegex.test(updateData.username)) {
          return res.status(400).json({
            error: 'Username can only contain lowercase letters, numbers, and underscores'
          });
        }
        if (updateData.username.length < 3 || updateData.username.length > 30) {
          return res.status(400).json({
            error: 'Username must be between 3 and 30 characters'
          });
        }

        // Check uniqueness
        const existing = await prisma.user.findUnique({
          where: { username: updateData.username }
        });
        if (existing && existing.id !== req.user.id) {
          return res.status(400).json({ error: 'Username already taken' });
        }
      }
    }

    // Validate website URL if provided
    if (updateData.website) {
      try {
        new URL(updateData.website);
      } catch {
        return res.status(400).json({ error: 'Invalid website URL' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        displayName: true,
        bio: true,
        location: true,
        website: true,
        username: true,
        socialInstagram: true,
        socialFacebook: true,
        socialTwitter: true,
        profileIsPublic: true,
        showEmail: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * CHECK username availability
 *
 * Public endpoint for real-time validation in the settings form.
 */
app.get('/api/users/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Validate format
    const usernameRegex = /^[a-z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      return res.json({ available: false, reason: 'Invalid format' });
    }

    const existing = await prisma.user.findUnique({
      where: { username }
    });

    res.json({ available: !existing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPLOAD avatar image
 *
 * Accepts multipart form data with an image file.
 * Uploads to DO Spaces and updates user.image field.
 */
app.post('/api/users/me/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Check if DO Spaces is configured
    if (!process.env.DO_SPACES_BUCKET) {
      return res.status(500).json({ error: 'Image upload not configured' });
    }

    // Upload to DO Spaces (200x200 avatar)
    const imageUrl = await uploadAvatar(req.file.buffer, req.user.id);

    // Update user's image URL in database
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { image: imageUrl },
      select: {
        id: true,
        image: true,
      },
    });

    res.json({ image: user.image });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

/**
 * DELETE avatar image
 *
 * Removes the user's avatar and sets image to null.
 */
app.delete('/api/users/me/avatar', requireAuth, async (req, res) => {
  try {
    // Delete from DO Spaces if configured
    if (process.env.DO_SPACES_BUCKET) {
      try {
        await deleteImage(`avatars/${req.user.id}.webp`);
      } catch (spacesError) {
        console.error('Spaces delete error:', spacesError);
        // Continue even if Spaces delete fails
      }
    }

    // Update user to remove image URL
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { image: null },
      select: {
        id: true,
        image: true,
      },
    });

    res.json({ image: null });
  } catch (error) {
    console.error('Avatar delete error:', error);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

/**
 * GET public profile by username
 *
 * Returns public profile data. Respects privacy settings.
 * Includes user's public lists.
 */
app.get('/api/users/:username', optionalAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      include: {
        lists: {
          where: { isPublic: true },
          include: {
            _count: { select: { listPlants: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy - allow if public OR if viewing own profile
    if (!user.profileIsPublic && req.user?.id !== user.id) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Calculate stats for the profile
    const [totalPlantsResult, photosContributed, reviewsWritten] = await Promise.all([
      // Count unique plants across all user's lists
      prisma.userPlant.count({
        where: { userId: user.id, listEntries: { some: {} } }
      }),
      // Photos contributed
      prisma.plantPhoto.count({
        where: { userId: user.id }
      }),
      // Reviews written
      prisma.review.count({
        where: { userId: user.id }
      })
    ]);

    const stats = {
      totalPlants: totalPlantsResult,
      publicLists: user.lists.length,
      photosContributed,
      reviewsWritten
    };

    // Return public-safe fields only
    res.json({
      id: user.id,
      displayName: user.displayName || user.name,
      username: user.username,
      image: user.image,
      bio: user.bio,
      location: user.location,
      website: user.website,
      socialInstagram: user.socialInstagram,
      socialFacebook: user.socialFacebook,
      socialTwitter: user.socialTwitter,
      email: user.showEmail ? user.email : undefined,
      createdAt: user.createdAt,
      isAvsaMember: user.isAvsaMember,
      localClub: user.localClub,
      otherAffiliation: user.otherAffiliation,
      stats,
      lists: user.lists.map(list => ({
        id: list.id,
        name: list.name,
        description: list.description,
        color: list.color,
        plantCount: list._count.listPlants,
      })),
      isOwnProfile: req.user?.id === user.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TAGS =====

/**
 * GET all tags, optionally filtered by category
 *
 * Query parameters:
 *   ?category=color - Filter by category (e.g., 'color', 'bloom_type', 'foliage')
 *
 * Returns tags sorted by sortOrder within each category, with counts of plants using each tag.
 */
app.get('/api/tags', async (req, res) => {
  try {
    const { category } = req.query;

    const tags = await prisma.tag.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        _count: {
          select: { plantTags: true },
        },
      },
    });

    // Transform to include count as a direct property
    const tagsWithCounts = tags.map(tag => ({
      id: tag.id,
      category: tag.category,
      name: tag.name,
      displayName: tag.displayName,
      color: tag.color,
      sortOrder: tag.sortOrder,
      plantCount: tag._count.plantTags,
    }));

    res.json(tagsWithCounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PLANTS =====

/**
 * GET paginated plants from catalog
 *
 * Query parameters:
 *   ?page=1     - Which page to fetch (1-indexed, default: 1)
 *   ?limit=50   - Items per page (default: 50, max: 100)
 *   ?search=    - Optional comma-separated search terms to filter by name
 *                 Multiple terms are AND'd together (must match all)
 *   ?sortBy=    - Sort order: 'name' (default), 'popularity', 'recent'
 *
 * Response format:
 *   {
 *     plants: [...],    // Array of plant objects for this page
 *     total: 5020,      // Total matching plants in database
 *     page: 1,          // Current page number
 *     limit: 50,        // Items per page
 *     totalPages: 101   // Total number of pages
 *   }
 *
 * WHY PAGINATION?
 * Loading 5,000+ plants at once is slow and uses lots of memory.
 * Pagination loads only what's visible (50 items), making the app fast.
 *
 * HOW IT WORKS:
 * - Prisma's `skip` tells the database how many rows to skip
 * - Prisma's `take` tells it how many rows to return
 * - Example: page=3, limit=50 → skip=100, take=50 (rows 101-150)
 */
app.get('/api/plants', async (req, res) => {
  try {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Cap at 100
    const searchParam = req.query.search || '';
    const sortBy = req.query.sortBy || 'popularity';
    const tagsParam = req.query.tags || '';  // Comma-separated tag names (e.g., "pink,blue")
    const hasPhotos = req.query.hasPhotos === 'true';  // Filter to show only plants with images

    // Calculate how many rows to skip
    const skip = (page - 1) * limit;

    // Parse search terms (comma-separated)
    const searchTerms = searchParam
      ? searchParam.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // Parse tag filters (comma-separated tag names)
    const tagFilters = tagsParam
      ? tagsParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];

    // Build the WHERE clause
    // Combine all filters into a single AND array for proper logic
    const andConditions = [];

    // Search term filters
    if (searchTerms.length > 0) {
      searchTerms.forEach(term => {
        andConditions.push({
          name: { contains: term, mode: 'insensitive' },
        });
      });
    }

    // Tag filters
    if (tagFilters.length > 0) {
      tagFilters.forEach(tagName => {
        andConditions.push({
          plantTags: {
            some: {
              tag: { name: tagName },
            },
          },
        });
      });
    }

    // Has photos filter - must have imageUrl OR non-empty featuredPhotos
    if (hasPhotos) {
      andConditions.push({
        OR: [
          { imageUrl: { not: null } },
          { NOT: { featuredPhotos: { isEmpty: true } } },
        ],
      });
    }

    const where = {
      ...(andConditions.length > 0 && { AND: andConditions }),
    };

    // Determine sort order based on sortBy parameter
    // - 'name': Alphabetical A-Z
    // - 'popularity': Most collected first, then alphabetical
    // - 'recent': Most recently added to collections first
    const orderByOptions = {
      name: [{ name: 'asc' }],
      popularity: [{ collectionCount: 'desc' }, { name: 'asc' }],
      recent: [{ lastCollected: 'desc' }, { name: 'asc' }],
    };
    const orderBy = orderByOptions[sortBy] || orderByOptions.name;

    // Run two queries in parallel for efficiency
    const [plants, total] = await Promise.all([
      prisma.plant.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.plant.count({ where }),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    // Return paginated response with metadata
    res.json({
      plants,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/plants/all', async (req, res) => {
  try {
    const plants = await prisma.plant.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(plants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET single plant with photos, reviews, and community stats
 *
 * Returns the plant along with:
 * - userPhotos: Photos uploaded by users
 * - reviews: User reviews
 * - wishlistCount: How many users have this in their Wishlist (calculated)
 * - collectionCount: Already on the plant from denormalized field
 */
app.get('/api/plants/:id', async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);

    // Fetch plant and wishlist count in parallel
    const [plant, wishlistCount] = await Promise.all([
      prisma.plant.findUnique({
        where: { id: plantId },
        include: {
          userPhotos: {
            orderBy: { uploadedAt: 'desc' }
          },
          reviews: {
            orderBy: { createdAt: 'desc' }
          },
          plantTags: {
            include: {
              tag: true
            }
          }
        }
      }),
      // Count how many users have this in their Wishlist
      prisma.listPlant.count({
        where: {
          userPlant: { catalogPlantId: plantId },
          list: { name: 'Wishlist' }
        }
      })
    ]);

    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Return plant with computed wishlistCount
    res.json({
      ...plant,
      wishlistCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plants', requireAdmin, async (req, res) => {
  try {
    const { description, ...plantData } = req.body;
    const generatedDescription = generateDescription(plantData);
    const plant = await prisma.plant.create({
      data: { ...plantData, description: generatedDescription }
    });
    res.json(plant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// REQUEST contribution to catalog
app.post('/api/plants/:id/contribute', async (req, res) => {
  try {
    const plant = await prisma.plant.update({
      where: { id: parseInt(req.params.id) },
      data: { contributionStatus: 'pending' }
    });
    res.json(plant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE plant in catalog
app.put('/api/plants/:id', async (req, res) => {
  try {
    // Strip out description from request - we'll regenerate it
    const { description, ...updateData } = req.body;

    // Fetch current plant data to merge with updates for description generation
    const currentPlant = await prisma.plant.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!currentPlant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Merge current data with updates to generate accurate description
    const mergedData = { ...currentPlant, ...updateData };
    const generatedDescription = generateDescription(mergedData);

    const plant = await prisma.plant.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...updateData,
        description: generatedDescription
      }
    });
    res.json(plant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE plant from catalog
app.delete('/api/plants/:id', async (req, res) => {
  try {
    await prisma.plant.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Plant deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== LISTS =====
// Lists are user-specific - each user has their own collection

/**
 * GET all lists FOR THE CURRENT USER
 *
 * IMPORTANT: We filter by userId so users only see their own lists.
 * This is the key to multi-user support!
 */
app.get('/api/lists', requireAuth, async (req, res) => {
  try {
    const lists = await prisma.list.findMany({
      where: { userId: req.user.id },  // Only this user's lists
      include: {
        listPlants: {
          include: {
            userPlant: {
              include: { catalogPlant: true }
            }
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' }
      ]
    });
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET single list
 *
 * Note: We verify the list belongs to the current user (ownership check)
 */
app.get('/api/lists/:id', requireAuth, async (req, res) => {
  try {
    const list = await prisma.list.findFirst({
      where: {
        id: parseInt(req.params.id),
        userId: req.user.id  // Must belong to this user
      },
      include: {
        listPlants: {
          include: {
            userPlant: {
              include: { catalogPlant: true }
            }
          }
        }
      }
    });
    if (!list) {
      return res.status(404).json({ error: 'List not found' });
    }
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * CREATE new list
 *
 * The userId is set from the authenticated user, not from the request body.
 * This prevents users from creating lists for other users.
 */
app.post('/api/lists', requireAuth, async (req, res) => {
  try {
    const { name, description, color, isPublic } = req.body;
    const list = await prisma.list.create({
      data: {
        userId: req.user.id,  // Always use authenticated user's ID
        name,
        description,
        color,
        isPublic: isPublic || false
      }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE list
 *
 * First verifies ownership, then updates.
 */
app.put('/api/lists/:id', requireAuth, async (req, res) => {
  try {
    // Verify ownership
    const existingList = await prisma.list.findFirst({
      where: {
        id: parseInt(req.params.id),
        userId: req.user.id
      }
    });

    if (!existingList) {
      return res.status(404).json({ error: 'List not found' });
    }

    const { name, description, color, isPublic } = req.body;
    const list = await prisma.list.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description, color, isPublic }
    });
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE list
 *
 * Only allows deleting lists you own, and not default lists.
 */
app.delete('/api/lists/:id', requireAuth, async (req, res) => {
  try {
    // Verify ownership and not default
    const existingList = await prisma.list.findFirst({
      where: {
        id: parseInt(req.params.id),
        userId: req.user.id
      }
    });

    if (!existingList) {
      return res.status(404).json({ error: 'List not found' });
    }

    if (existingList.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default lists' });
    }

    await prisma.list.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'List deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== LIST PLANTS =====
// Managing plants within lists - all require auth and ownership verification

/**
 * ADD a UserPlant to a list
 *
 * :userPlantId is the ID of the UserPlant record — not a catalog Plant ID.
 * The frontend is responsible for creating/finding the UserPlant first.
 */
app.post('/api/lists/:listId/user-plants/:userPlantId', requireAuth, async (req, res) => {
  try {
    const listId = parseInt(req.params.listId);
    const userPlantId = parseInt(req.params.userPlantId);

    const list = await prisma.list.findFirst({
      where: { id: listId, userId: req.user.id }
    });
    if (!list) return res.status(404).json({ error: 'List not found' });

    // Verify the UserPlant belongs to this user
    const userPlant = await prisma.userPlant.findFirst({
      where: { id: userPlantId, userId: req.user.id }
    });
    if (!userPlant) return res.status(404).json({ error: 'UserPlant not found' });

    const existingEntry = await prisma.listPlant.findUnique({
      where: { listId_userPlantId: { listId, userPlantId } }
    });

    const listPlant = await prisma.listPlant.upsert({
      where: { listId_userPlantId: { listId, userPlantId } },
      update: {},
      create: { listId, userPlantId }
    });

    // Track popularity: if adding to "My Collection" for the first time
    if (list.name === 'My Collection' && !existingEntry && userPlant.catalogPlantId) {
      await prisma.plant.update({
        where: { id: userPlant.catalogPlantId },
        data: { collectionCount: { increment: 1 }, lastCollected: new Date() }
      });
    }

    res.json({ ...listPlant, userPlant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE notes on a UserPlant
 *
 * Notes live on UserPlant, not ListPlant. :userPlantId identifies which plant.
 */
app.put('/api/user-plants/:userPlantId/notes', requireAuth, async (req, res) => {
  try {
    const userPlantId = parseInt(req.params.userPlantId);
    const { notes } = req.body;

    const userPlant = await prisma.userPlant.findFirst({
      where: { id: userPlantId, userId: req.user.id }
    });
    if (!userPlant) return res.status(404).json({ error: 'UserPlant not found' });

    const updated = await prisma.userPlant.update({
      where: { id: userPlantId },
      data: { customNotes: notes }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * REMOVE a UserPlant from a list
 *
 * Deletes the ListPlant entry. The UserPlant itself is preserved.
 * If removing from "My Collection", decrements the catalog plant's popularity count.
 */
app.delete('/api/lists/:listId/user-plants/:userPlantId', requireAuth, async (req, res) => {
  try {
    const listId = parseInt(req.params.listId);
    const userPlantId = parseInt(req.params.userPlantId);

    const list = await prisma.list.findFirst({
      where: { id: listId, userId: req.user.id }
    });
    if (!list) return res.status(404).json({ error: 'List not found' });

    const userPlant = await prisma.userPlant.findFirst({
      where: { id: userPlantId, userId: req.user.id }
    });
    if (!userPlant) return res.status(404).json({ error: 'UserPlant not found' });

    const existingEntry = await prisma.listPlant.findUnique({
      where: { listId_userPlantId: { listId, userPlantId } }
    });

    await prisma.listPlant.deleteMany({ where: { listId, userPlantId } });

    if (list.name === 'My Collection' && existingEntry && userPlant.catalogPlantId) {
      await prisma.plant.update({
        where: { id: userPlant.catalogPlantId },
        data: { collectionCount: { decrement: 1 } }
      });
      await prisma.plant.updateMany({
        where: { id: userPlant.catalogPlantId, collectionCount: { lt: 0 } },
        data: { collectionCount: 0 }
      });
    }

    res.json({ message: 'Plant removed from list' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== USER PLANTS =====

/**
 * GET all UserPlants for the current user
 */
app.get('/api/user-plants', requireAuth, async (req, res) => {
  try {
    const userPlants = await prisma.userPlant.findMany({
      where: { userId: req.user.id },
      include: { catalogPlant: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(userPlants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * CREATE a UserPlant
 * { catalogPlantId } → links to catalog variety (find-or-creates to avoid duplicates)
 * { customName, ... } → fully custom entry
 */
app.post('/api/user-plants', requireAuth, async (req, res) => {
  try {
    const { catalogPlantId, customName, customHybridizer, customBlossom, customFoliage, customHabit, customNotes, dateAcquired, sourceNotes } = req.body;

    if (catalogPlantId) {
      const existing = await prisma.userPlant.findFirst({
        where: { userId: req.user.id, catalogPlantId: parseInt(catalogPlantId) },
        include: { catalogPlant: true }
      });
      if (existing) return res.json(existing);
    }

    const userPlant = await prisma.userPlant.create({
      data: {
        userId: req.user.id,
        catalogPlantId: catalogPlantId ? parseInt(catalogPlantId) : null,
        customName, customHybridizer, customBlossom, customFoliage, customHabit,
        customNotes, dateAcquired, sourceNotes
      },
      include: { catalogPlant: true }
    });

    res.json(userPlant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPDATE a UserPlant (notes, acquisition date, custom fields)
 */
app.put('/api/user-plants/:id', requireAuth, async (req, res) => {
  try {
    const userPlantId = parseInt(req.params.id);
    const existing = await prisma.userPlant.findFirst({
      where: { id: userPlantId, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ error: 'UserPlant not found' });

    const { customName, customHybridizer, customBlossom, customFoliage, customHabit, customNotes, dateAcquired, sourceNotes } = req.body;

    const updated = await prisma.userPlant.update({
      where: { id: userPlantId },
      data: { customName, customHybridizer, customBlossom, customFoliage, customHabit, customNotes, dateAcquired, sourceNotes },
      include: { catalogPlant: true }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE a UserPlant — cascades from all lists automatically
 */
app.delete('/api/user-plants/:id', requireAuth, async (req, res) => {
  try {
    const userPlantId = parseInt(req.params.id);
    const existing = await prisma.userPlant.findFirst({
      where: { id: userPlantId, userId: req.user.id }
    });
    if (!existing) return res.status(404).json({ error: 'UserPlant not found' });

    await prisma.userPlant.delete({ where: { id: userPlantId } });
    res.json({ message: 'UserPlant deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PLANT PHOTOS =====

// GET photos for a plant
app.get('/api/plants/:plantId/photos', async (req, res) => {
  try {
    const photos = await prisma.plantPhoto.findMany({
      where: { plantId: parseInt(req.params.plantId) },
      orderBy: { uploadedAt: 'desc' }
    });
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADD photo to plant (with URL - legacy support)
app.post('/api/plants/:plantId/photos', async (req, res) => {
  try {
    const plantId = parseInt(req.params.plantId);
    const { imageUrl, thumbnailUrl, caption } = req.body;

    const photo = await prisma.plantPhoto.create({
      data: {
        plantId,
        imageUrl,
        thumbnailUrl,
        caption
      }
    });
    res.json(photo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UPLOAD photo for a plant
 *
 * Accepts multipart form data with an image file.
 * Creates main (1024px) and thumbnail (300x300) versions.
 * Uploads to DO Spaces and creates PlantPhoto record.
 */
app.post('/api/plants/:plantId/photos/upload', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const plantId = parseInt(req.params.plantId);

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Check if DO Spaces is configured
    if (!process.env.DO_SPACES_BUCKET) {
      return res.status(500).json({ error: 'Image upload not configured' });
    }

    // Verify plant exists
    const plant = await prisma.plant.findUnique({
      where: { id: plantId }
    });

    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Generate unique ID for this photo
    const photoId = randomUUID();
    const baseKey = `user-photos/${plantId}/${photoId}`;

    // Upload main and thumbnail versions
    const urls = await uploadImageVersions(req.file.buffer, baseKey);

    // Create photo record
    const photo = await prisma.plantPhoto.create({
      data: {
        plantId,
        userId: req.user.id,
        imageUrl: urls.main,
        thumbnailUrl: urls.thumb,
        caption: req.body.caption || null,
      }
    });

    res.json(photo);
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// DELETE photo
app.delete('/api/photos/:id', async (req, res) => {
  try {
    await prisma.plantPhoto.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Photo deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== REVIEWS =====

// GET reviews for a plant
app.get('/api/plants/:plantId/reviews', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { plantId: parseInt(req.params.plantId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE review
app.post('/api/plants/:plantId/reviews', async (req, res) => {
  try {
    const plantId = parseInt(req.params.plantId);
    const { userName, rating, title, content } = req.body;

    const review = await prisma.review.create({
      data: {
        plantId,
        userName,
        rating,
        title,
        content
      }
    });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE review
app.put('/api/reviews/:id', async (req, res) => {
  try {
    const review = await prisma.review.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    await prisma.review.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN =====

/**
 * Admin stats cache
 * Stores computed statistics with a timestamp for cache invalidation
 */
let adminStatsCache = {
  data: null,
  timestamp: null,
  CACHE_TTL: 60 * 60 * 1000, // 1 hour in milliseconds
};

/**
 * GET /api/admin/stats - Get admin dashboard statistics
 *
 * Returns cached statistics about the catalog:
 * - Color popularity in user collections (pie chart data)
 * - Total users, total plants collected
 *
 * Caches results for 1 hour to avoid expensive queries.
 */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (
      adminStatsCache.data &&
      adminStatsCache.timestamp &&
      now - adminStatsCache.timestamp < adminStatsCache.CACHE_TTL
    ) {
      return res.json({
        ...adminStatsCache.data,
        cached: true,
        cachedAt: new Date(adminStatsCache.timestamp).toISOString(),
      });
    }

    // Compute fresh stats

    // 1. Color popularity in collections (only "My Collection" lists)
    const colorTags = await prisma.tag.findMany({
      where: { category: 'color' },
      select: {
        name: true,
        displayName: true,
        color: true,
        plantTags: {
          where: {
            plant: {
              userPlants: {
                some: {
                  listEntries: {
                    some: {
                      list: { name: 'My Collection' },
                    },
                  },
                },
              },
            },
          },
          select: { plantId: true },
        },
      },
    });

    // Count unique plants per color in collections
    const collectionColorCounts = colorTags.map((tag) => ({
      name: tag.name,
      displayName: tag.displayName,
      color: tag.color,
      count: new Set(tag.plantTags.map((pt) => pt.plantId)).size,
    }));

    // 1b. Color distribution in the entire catalog (for comparison)
    const catalogColorTags = await prisma.tag.findMany({
      where: { category: 'color' },
      select: {
        name: true,
        displayName: true,
        color: true,
        plantTags: {
          select: { plantId: true },
        },
      },
    });

    // Count unique plants per color in catalog
    const catalogColorCounts = catalogColorTags.map((tag) => ({
      name: tag.name,
      count: new Set(tag.plantTags.map((pt) => pt.plantId)).size,
    }));

    // Calculate totals for percentage computation
    const totalCollectedByColor = collectionColorCounts.reduce((sum, c) => sum + c.count, 0);
    const totalCatalogByColor = catalogColorCounts.reduce((sum, c) => sum + c.count, 0);

    // Build combined color stats with collection index
    const colorStats = collectionColorCounts
      .map((collected) => {
        const catalog = catalogColorCounts.find((c) => c.name === collected.name);
        const catalogCount = catalog?.count || 0;

        // Calculate percentages
        const collectionPct = totalCollectedByColor > 0 ? (collected.count / totalCollectedByColor) * 100 : 0;
        const catalogPct = totalCatalogByColor > 0 ? (catalogCount / totalCatalogByColor) * 100 : 0;

        // Collection index: ratio of collection % to catalog %
        // > 1 means over-collected, < 1 means under-collected
        const collectionIndex = catalogPct > 0 ? collectionPct / catalogPct : 0;

        return {
          name: collected.name,
          displayName: collected.displayName,
          color: collected.color,
          count: collected.count,           // Plants of this color in collections
          catalogCount,                      // Plants of this color in catalog
          collectionPct: Math.round(collectionPct * 10) / 10,
          catalogPct: Math.round(catalogPct * 10) / 10,
          collectionIndex: Math.round(collectionIndex * 100) / 100,
        };
      })
      .filter((tag) => tag.count > 0 || tag.catalogCount > 0)
      .sort((a, b) => b.count - a.count);

    // 2. Total users
    const totalUsers = await prisma.user.count();

    // 3. Total plants in collections
    const totalCollectedPlants = await prisma.listPlant.count({
      where: {
        list: { name: 'My Collection' },
      },
    });

    // 4. Total catalog plants
    const totalCatalogPlants = await prisma.plant.count();

    // 5. Sticktite varieties by registration year
    const sticktitePlants = await prisma.plant.findMany({
      where: {
        blossom: { contains: 'sticktite', mode: 'insensitive' },
        regDate: { not: null },
      },
      select: { regDate: true },
    });

    const yearCounts = {};
    for (const { regDate } of sticktitePlants) {
      const match = regDate.match(/\d{4}/);
      if (!match) continue;
      const year = parseInt(match[0], 10);
      if (year < 1900 || year > new Date().getFullYear()) continue;
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
    const sticktiteYearStats = Object.entries(yearCounts)
      .map(([year, count]) => ({ year: parseInt(year, 10), count }))
      .sort((a, b) => a.year - b.year);

    // Build stats object
    const stats = {
      colorStats,
      totalUsers,
      totalCollectedPlants,
      totalCatalogPlants,
      sticktiteYearStats,
      computedAt: new Date().toISOString(),
    };

    // Update cache
    adminStatsCache.data = stats;
    adminStatsCache.timestamp = now;

    res.json({ ...stats, cached: false });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/stats/refresh - Force refresh of admin stats cache
 */
app.post('/api/admin/stats/refresh', requireAdmin, async (req, res) => {
  adminStatsCache.data = null;
  adminStatsCache.timestamp = null;
  res.json({ message: 'Stats cache cleared' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});