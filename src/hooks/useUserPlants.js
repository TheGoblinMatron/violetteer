/**
 * useUserPlants - Hook for managing the current user's UserPlant records
 *
 * A UserPlant is the user's personal instance of a violet — either linked
 * to a catalog variety (catalogPlantId set) or a fully custom entry.
 *
 * This hook:
 * - Loads all UserPlants for the logged-in user on mount
 * - Provides find-or-create for catalog plants (avoids duplicates)
 * - Provides create for custom plants
 * - Provides update and delete
 * - Provides a lookup helper for components that know a catalog Plant ID
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

export function useUserPlants() {
  const [userPlants, setUserPlants] = useState([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const fetchUserPlants = useCallback(async () => {
    if (!isAuthenticated) {
      setUserPlants([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/user-plants`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUserPlants(data);
      }
    } catch (error) {
      console.error('Error fetching user plants:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) fetchUserPlants();
  }, [authLoading, fetchUserPlants]);

  /**
   * Find an existing UserPlant for a catalog variety, or create one if absent.
   * Returns the UserPlant object.
   */
  const findOrCreateUserPlant = async (catalogPlantId) => {
    // Check local state first to avoid a network round-trip
    const existing = userPlants.find((up) => up.catalogPlantId === catalogPlantId);
    if (existing) return existing;

    try {
      const response = await fetch(`${API_URL}/user-plants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ catalogPlantId }),
      });
      if (!response.ok) throw new Error('Failed to create UserPlant');
      const userPlant = await response.json();
      setUserPlants((prev) => [...prev, userPlant]);
      return userPlant;
    } catch (error) {
      console.error('Error finding/creating UserPlant:', error);
      return null;
    }
  };

  /**
   * Create a custom UserPlant with no catalog link.
   */
  const createCustomUserPlant = async (customData) => {
    try {
      const response = await fetch(`${API_URL}/user-plants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(customData),
      });
      if (!response.ok) throw new Error('Failed to create custom UserPlant');
      const userPlant = await response.json();
      setUserPlants((prev) => [...prev, userPlant]);
      return userPlant;
    } catch (error) {
      console.error('Error creating custom UserPlant:', error);
      return null;
    }
  };

  /**
   * Update a UserPlant's notes or other personal fields.
   */
  const updateUserPlant = async (userPlantId, data) => {
    try {
      const response = await fetch(`${API_URL}/user-plants/${userPlantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update UserPlant');
      const updated = await response.json();
      setUserPlants((prev) => prev.map((up) => (up.id === updated.id ? updated : up)));
      return updated;
    } catch (error) {
      console.error('Error updating UserPlant:', error);
      return null;
    }
  };

  /**
   * Delete a UserPlant. This also removes it from all lists (cascade).
   */
  const deleteUserPlant = async (userPlantId) => {
    try {
      const response = await fetch(`${API_URL}/user-plants/${userPlantId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete UserPlant');
      setUserPlants((prev) => prev.filter((up) => up.id !== userPlantId));
    } catch (error) {
      console.error('Error deleting UserPlant:', error);
    }
  };

  /**
   * Look up a UserPlant by catalog Plant ID. Returns undefined if not found.
   * Use this when you know the catalog plant and want to check if the user owns it.
   */
  const getUserPlantForCatalogPlant = (catalogPlantId) =>
    userPlants.find((up) => up.catalogPlantId === catalogPlantId);

  return {
    userPlants,
    loading,
    findOrCreateUserPlant,
    createCustomUserPlant,
    updateUserPlant,
    deleteUserPlant,
    getUserPlantForCatalogPlant,
    refetch: fetchUserPlants,
  };
}
