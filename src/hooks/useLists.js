/**
 * useLists - Custom hook for managing user lists
 *
 * WHAT IS A CUSTOM HOOK?
 * A custom hook is just a function that uses React hooks (useState, useEffect, etc.)
 * and returns values/functions for components to use. The naming convention is
 * "use" + something (useLists, useAuth, useForm, etc.).
 *
 * WHY EXTRACT THIS?
 * 1. Separation of concerns: List logic lives in one place
 * 2. Reusability: Any component can call useLists()
 * 3. Testing: Easier to test API logic in isolation
 * 4. Readability: App.jsx becomes focused on routing/layout
 *
 * WHAT THIS HOOK MANAGES:
 * - lists state (array of user's lists)
 * - loading state
 * - CRUD operations for lists
 * - Adding/removing plants from lists
 * - Updating notes on plants in lists
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

export function useLists() {
  // State
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get auth state - we need to know if user is logged in
  const { isAuthenticated, loading: authLoading } = useAuth();

  /**
   * Fetch all lists for the current user
   *
   * useCallback memoizes this function so it doesn't get recreated
   * on every render. This is important because we use it in useEffect.
   */
  const fetchLists = useCallback(async () => {
    if (!isAuthenticated) {
      setLists([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/lists`, {
        credentials: 'include', // Send session cookie
      });

      if (response.ok) {
        const data = await response.json();
        setLists(data);
      } else {
        console.error('Error fetching lists:', response.status);
        setLists([]);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Fetch lists when auth state changes
   *
   * This effect runs:
   * 1. On initial mount (after auth check completes)
   * 2. When isAuthenticated changes (login/logout)
   */
  useEffect(() => {
    if (!authLoading) {
      fetchLists();
    }
  }, [authLoading, fetchLists]);

  /**
   * Create a new list
   *
   * @param {Object} listData - { name, description, color, isPublic }
   * @returns {Object|null} The created list or null on error
   */
  const createList = async (listData) => {
    try {
      const response = await fetch(`${API_URL}/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(listData),
      });

      if (!response.ok) {
        throw new Error('Failed to create list');
      }

      const newList = await response.json();
      // Add to local state immediately (optimistic update)
      setLists((prev) => [...prev, newList]);
      return newList;
    } catch (error) {
      console.error('Error creating list:', error);
      return null;
    }
  };

  /**
   * Update an existing list
   *
   * @param {Object} listData - { id, name, description, color, isPublic }
   */
  const updateList = async (listData) => {
    try {
      const response = await fetch(`${API_URL}/lists/${listData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(listData),
      });

      if (!response.ok) {
        throw new Error('Failed to update list');
      }

      const updatedList = await response.json();
      // Update local state
      setLists((prev) =>
        prev.map((list) => (list.id === updatedList.id ? updatedList : list))
      );

      // Refetch to get full data with relations
      await fetchLists();
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  /**
   * Delete a list
   *
   * @param {number} listId
   */
  const deleteList = async (listId) => {
    try {
      const response = await fetch(`${API_URL}/lists/${listId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }

      // Remove from local state
      setLists((prev) => prev.filter((list) => list.id !== listId));
    } catch (error) {
      console.error('Error deleting list:', error);
    }
  };

  /**
   * Add a plant to a list
   *
   * @param {number} listId
   * @param {number} plantId
   * @param {string} notes - Optional notes
   */
  const addToList = async (listId, plantId, notes = '') => {
    try {
      await fetch(`${API_URL}/lists/${listId}/plants/${plantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes }),
      });

      // Refetch lists to get updated listPlants
      await fetchLists();
    } catch (error) {
      console.error('Error adding to list:', error);
    }
  };

  /**
   * Remove a plant from a list
   *
   * @param {number} listId
   * @param {number} plantId
   */
  const removeFromList = async (listId, plantId) => {
    try {
      await fetch(`${API_URL}/lists/${listId}/plants/${plantId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      // Refetch lists to get updated listPlants
      await fetchLists();
    } catch (error) {
      console.error('Error removing from list:', error);
    }
  };

  /**
   * Update notes for a plant in a list
   *
   * @param {number} listId
   * @param {number} plantId
   * @param {string} notes
   */
  const updateNotes = async (listId, plantId, notes) => {
    try {
      await fetch(`${API_URL}/lists/${listId}/plants/${plantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes }),
      });

      // Refetch lists to get updated data
      await fetchLists();
    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  /**
   * Helper: Get all list IDs that contain a specific plant
   *
   * @param {number} plantId
   * @returns {number[]} Array of list IDs
   */
  const getListsForPlant = (plantId) => {
    return lists
      .filter((list) => list.listPlants?.some((lp) => lp.plantId === plantId))
      .map((list) => list.id);
  };

  // Return everything components need
  return {
    // State
    lists,
    loading,

    // CRUD operations
    createList,
    updateList,
    deleteList,

    // Plant-in-list operations
    addToList,
    removeFromList,
    updateNotes,

    // Helpers
    getListsForPlant,
    refetch: fetchLists,
  };
}
