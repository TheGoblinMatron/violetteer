/**
 * AuthContext - React Context for Authentication State
 *
 * This provides authentication state and functions to all components
 * in your app without prop drilling.
 *
 * REACT CONTEXT PATTERN:
 * 1. createContext() creates a "container" for shared state
 * 2. AuthProvider wraps your app and "provides" the state
 * 3. useAuth() hook lets any component access the state
 *
 * WHY USE CONTEXT?
 * Without context, you'd need to pass user data as props through
 * every component: App -> Layout -> Header -> UserMenu
 * With context, UserMenu can directly access auth state.
 */

import { createContext, useContext } from 'react';
import { useSession, signIn, signUp, signOut } from '../lib/auth-client';

// Create the context with null as default (will be set by Provider)
const AuthContext = createContext(null);

/**
 * AuthProvider - Wraps your app to provide auth state
 *
 * Usage in App.jsx:
 *   <AuthProvider>
 *     <Router>...</Router>
 *   </AuthProvider>
 */
export function AuthProvider({ children }) {
  // useSession is a Better Auth hook that:
  // - Returns current session data if logged in
  // - Returns null if not logged in
  // - Handles loading state while checking
  const { data: session, isPending, error } = useSession();

  // Wrapper functions for signing in/out with better error handling
  const handleSignIn = async (email, password) => {
    const result = await signIn.email({
      email,
      password,
    });

    if (result.error) {
      throw new Error(result.error.message || 'Sign in failed');
    }

    return result.data;
  };

  const handleSignUp = async (email, password, name) => {
    const result = await signUp.email({
      email,
      password,
      name,
    });

    if (result.error) {
      throw new Error(result.error.message || 'Sign up failed');
    }

    return result.data;
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // The value object that will be available to all consumers
  const value = {
    // User data (null if not logged in)
    user: session?.user ?? null,

    // Loading state (true while checking session)
    loading: isPending,

    // Error state
    error,

    // Convenience booleans
    isAuthenticated: !!session?.user,
    isAdmin: !!session?.user?.isAdmin,

    // Auth functions
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth - Custom hook to access auth context
 *
 * Usage in any component:
 *   const { user, isAuthenticated, signIn, signOut } = useAuth();
 *
 * Throws an error if used outside of AuthProvider (helps catch bugs)
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
