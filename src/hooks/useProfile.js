/**
 * useProfile - Custom hook for managing user profile data
 *
 * Handles:
 * - Fetching the current user's profile
 * - Updating profile fields
 * - Checking username availability
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

export function useProfile() {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  /**
   * Fetch current user's profile
   */
  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch profile when auth state changes
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /**
   * Update the current user's profile
   *
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated profile or null on error
   */
  const updateProfile = async (updates) => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Check if a username is available
   *
   * @param {string} username - Username to check
   * @returns {Object} { available: boolean, reason?: string }
   */
  const checkUsername = async (username) => {
    try {
      const response = await fetch(`${API_URL}/users/check-username/${username}`);
      return await response.json();
    } catch (err) {
      console.error('Error checking username:', err);
      return { available: false, reason: 'Error checking availability' };
    }
  };

  /**
   * Fetch a public profile by username
   *
   * @param {string} username - Username to fetch
   * @returns {Object|null} Public profile or null if not found
   */
  const fetchPublicProfile = async (username) => {
    try {
      const response = await fetch(`${API_URL}/users/${username}`, {
        credentials: 'include', // Include auth to check if viewing own profile
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch profile');
      }

      return await response.json();
    } catch (err) {
      console.error('Error fetching public profile:', err);
      return null;
    }
  };

  return {
    profile,
    loading,
    error,
    saving,
    updateProfile,
    checkUsername,
    fetchPublicProfile,
    refetch: fetchProfile,
  };
}
