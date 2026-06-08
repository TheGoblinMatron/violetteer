/**
 * Better Auth Configuration
 *
 * This file sets up Better Auth with the Prisma adapter to store
 * users and sessions in your PostgreSQL database.
 *
 * KEY CONCEPTS:
 *
 * 1. betterAuth() - The main configuration function that creates the auth instance
 *
 * 2. prismaAdapter - Connects Better Auth to your existing Prisma/PostgreSQL setup
 *    This means User and Session tables live alongside your Plant, List tables
 *
 * 3. emailAndPassword - Enables traditional email + password authentication
 *    Better Auth handles password hashing (bcrypt) automatically
 *
 * 4. trustedOrigins - CORS-like setting that specifies which frontend URLs
 *    are allowed to make authentication requests
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { PrismaClient } from "@prisma/client";
import { sendPasswordReset, sendVerificationEmail } from "./email.js";

const prisma = new PrismaClient();

// Where the app lives — used by better-auth for absolute URLs in
// callbacks, password-reset links, verification links, etc.
// In dev this is the backend port; in prod this would be e.g.
// https://violetteer.com (configured via .env).
const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3001";

// Where the FRONTEND lives — used for trustedOrigins (CORS-equivalent
// for auth requests) AND for constructing callback URLs in verification
// emails. The Vite dev server runs on 5173; prod overrides via env.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URLS = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

export const auth = betterAuth({
  // The canonical URL where this auth instance is reachable. Used to
  // build absolute reset/verify links in emails. Required for prod
  // deployments — better-auth warns if absent.
  baseURL: BASE_URL,

  // Database configuration - uses your existing Prisma setup
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Include custom user fields in session
  // By default, Better Auth only returns: id, email, name, image, emailVerified
  // We need isAdmin to be available on the frontend for authorization checks
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        defaultValue: false,
      },
    },
  },

  // Enable email/password authentication
  emailAndPassword: {
    enabled: true,
    // Users must verify their email before they can sign in.
    requireEmailVerification: true,
    // Wire up password reset — called when a user submits the
    // forgot-password form. The `url` is a one-time reset link
    // valid for ~1 hour (better-auth's default).
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordReset({ to: user.email, resetUrl: url, user });
    },
  },

  // Email verification: called on signup and when a user requests
  // a resend. We construct the verification URL ourselves so we can
  // set a proper callbackURL pointing at the FRONTEND. Without this,
  // better-auth defaults to BASE_URL (the backend) which has no
  // route at '/' and shows "Cannot GET /" after verification.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      const callbackURL = `${FRONTEND_URL}/email-verified`;
      const verifyUrl =
        `${BASE_URL}/api/auth/verify-email` +
        `?token=${encodeURIComponent(token)}` +
        `&callbackURL=${encodeURIComponent(callbackURL)}`;
      await sendVerificationEmail({ to: user.email, verifyUrl, user });
    },
  },

  // Frontend URLs that are allowed to make auth requests.
  // Add prod frontend origin via FRONTEND_URL env var when deploying.
  trustedOrigins: FRONTEND_URLS,

  // Session configuration
  session: {
    // How long until the session expires (7 days)
    expiresIn: 60 * 60 * 24 * 7,
    // How often to refresh the session (1 day)
    updateAge: 60 * 60 * 24,
    // Use cookies for session storage (more secure than localStorage)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache session in cookie for 5 minutes
    },
  },

  // Hooks - run custom code when auth events happen
  // Using createAuthMiddleware for the "after" hook
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Only run after signup - create default lists for new users
      if (ctx.path.startsWith("/sign-up")) {
        const newSession = ctx.context.newSession;
        if (newSession?.user?.id) {
          await createDefaultListsForUser(newSession.user.id);
        }
      }
    }),
  },
});

/**
 * Create default lists for a new user
 *
 * Every new user gets:
 * - "My Collection" - Plants they own
 * - "Wishlist" - Plants they want
 *
 * @param {string} userId - The ID of the newly created user
 */
async function createDefaultListsForUser(userId) {
  try {
    await prisma.list.createMany({
      data: [
        {
          userId,
          name: "My Collection",
          description: "African violets I currently own",
          color: "#4CAF50", // Green
          isPublic: false,
        },
        {
          userId,
          name: "Wishlist",
          description: "Varieties I'd love to add to my collection",
          color: "#E91E63", // Pink
          isPublic: false,
        },
      ],
    });
    console.log(`Created default lists for user ${userId}`);
  } catch (error) {
    // Log but don't throw - we don't want to fail the signup
    console.error("Error creating default lists:", error);
  }
}

/**
 * WHAT HAPPENS WHEN A USER REGISTERS:
 *
 * 1. Better Auth receives email + password
 * 2. Password is hashed using bcrypt (you never store plain text!)
 * 3. A new User record is created in your database
 * 4. An Account record is created (links User to the "credential" provider)
 * 5. A Session record is created with a secure token
 * 6. The session token is sent to the browser as an httpOnly cookie
 *
 * WHAT HAPPENS ON EACH REQUEST:
 *
 * 1. Browser automatically sends the session cookie
 * 2. Better Auth looks up the Session in the database
 * 3. If valid and not expired, the User is attached to the request
 * 4. Your route handlers can access req.user
 */
