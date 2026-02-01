/**
 * Authentication Middleware
 *
 * This middleware checks if a user is logged in by verifying their session
 * with Better Auth. It's used to protect routes that require authentication.
 *
 * HOW IT WORKS:
 * 1. Browser sends session cookie with the request
 * 2. We pass request headers to Better Auth
 * 3. Better Auth looks up the session in the database
 * 4. If valid, we get back the user data and attach it to req.user
 * 5. If invalid/expired, we return 401 Unauthorized
 */

import { auth } from '../lib/auth.js';

/**
 * requireAuth - Middleware that blocks unauthenticated requests
 *
 * Use this for routes that MUST have a logged-in user:
 *   app.get('/api/lists', requireAuth, async (req, res) => { ... })
 *
 * After this middleware runs, you can access:
 *   req.user - The authenticated user object
 *   req.session - The session object
 */
export const requireAuth = async (req, res, next) => {
  try {
    // Get session from Better Auth using the request headers (which include cookies)
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Attach user and session to request for use in route handlers
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * optionalAuth - Middleware that populates req.user if logged in, but doesn't block
 *
 * Use this for routes that work for both authenticated and anonymous users:
 *   app.get('/api/plants', optionalAuth, async (req, res) => {
 *     if (req.user) {
 *       // Show personalized results
 *     } else {
 *       // Show public results
 *     }
 *   })
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (session) {
      req.user = session.user;
      req.session = session.session;
    }

    next();
  } catch (error) {
    // Don't fail on auth errors - just continue without user
    next();
  }
};
