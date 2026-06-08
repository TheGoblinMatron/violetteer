/**
 * Better Auth Client Configuration
 *
 * This creates the client-side auth utilities for React.
 * It communicates with the Better Auth endpoints on your Express server.
 *
 * KEY EXPORTS:
 * - signIn: Function to log in with email/password
 * - signUp: Function to register a new account
 * - signOut: Function to log out
 * - useSession: React hook to get current session state
 *
 * HOW IT WORKS:
 * 1. createAuthClient connects to your backend at baseURL
 * 2. When you call signIn/signUp, it makes requests to /api/auth/*
 * 3. The server sets an httpOnly cookie with the session token
 * 4. useSession checks that cookie to know if you're logged in
 */

import { createAuthClient } from 'better-auth/react';

// Create the auth client pointing to your Express server
export const authClient = createAuthClient({
  baseURL: 'http://localhost:3001',
});

// Destructure the methods we'll use throughout the app
export const {
  signIn,             // signIn.email({ email, password })
  signUp,             // signUp.email({ email, password, name })
  signOut,            // signOut()
  useSession,         // React hook: const { data: session, isPending } = useSession()
  forgetPassword,     // forgetPassword({ email, redirectTo })
  resetPassword,      // resetPassword({ newPassword, token })
  sendVerificationEmail, // sendVerificationEmail({ email, callbackURL })
} = authClient;
