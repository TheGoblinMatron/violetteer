/**
 * useLists - Custom hook for managing user lists
 *
 * After the UserPlant refactor, lists contain UserPlant records rather than
 * Plant records directly. Key changes from the old version:
 *
 * - addUserPlantToList(listId, userPlantId) — replaces addToList
 * - removeUserPlantFromList(listId, userPlantId) — replaces removeFromList
 * - updateNotes is removed — notes now live on UserPlant (use useUserPlants.updateUserPlant)
 * - getListsForPlant(catalogPlantId) still works but now looks through userPlant.catalogPlantId
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

export function useLists() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const fetchLists = useCallback(async () => {
    if (!isAuthenticated) {
      setLists([]);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/lists`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setLists(data);
      } else {
        setLists([]);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) fetchLists();
  }, [authLoading, fetchLists]);

  const createList = async (listData) => {
    try {
      const response = await fetch(`${API_URL}/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(listData),
      });
      if (!response.ok) throw new Error('Failed to create list');
      const newList = await response.json();
      setLists((prev) => [...prev, newList]);
      return newList;
    } catch (error) {
      console.error('Error creating list:', error);
      return null;
    }
  };

  const updateList = async (listData) => {
    try {
      const response = await fetch(`${API_URL}/lists/${listData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(listData),
      });
      if (!response.ok) throw new Error('Failed to update list');
      await fetchLists();
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  const deleteList = async (listId) => {
    try {
      const response = await fetch(`${API_URL}/lists/${listId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete list');
      setLists((prev) => prev.filter((list) => list.id !== listId));
    } catch (error) {
      console.error('Error deleting list:', error);
    }
  };

  /**
   * Add a UserPlant to a list.
   * @param {number} listId
   * @param {number} userPlantId — the UserPlant.id (not a catalog Plant.id)
   */
  const addUserPlantToList = async (listId, userPlantId) => {
    try {
      await fetch(`${API_URL}/lists/${listId}/user-plants/${userPlantId}`, {
        method: 'POST',
        credentials: 'include',
      });
      await fetchLists();
    } catch (error) {
      console.error('Error adding UserPlant to list:', error);
    }
  };

  /**
   * Remove a UserPlant from a list.
   * The UserPlant record itself is preserved — only the list membership is removed.
   * @param {number} listId
   * @param {number} userPlantId — the UserPlant.id (not a catalog Plant.id)
   */
  const removeUserPlantFromList = async (listId, userPlantId) => {
    try {
      await fetch(`${API_URL}/lists/${listId}/user-plants/${userPlantId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchLists();
    } catch (error) {
      console.error('Error removing UserPlant from list:', error);
    }
  };

  /**
   * Find which lists contain a specific catalog plant.
   * Looks through listPlant.userPlant.catalogPlantId to find matches.
   * @param {number} catalogPlantId — a catalog Plant.id
   * @returns {number[]} array of list IDs
   */
  const getListsForPlant = (catalogPlantId) => {
    return lists
      .filter((list) =>
        list.listPlants?.some((lp) => lp.userPlant?.catalogPlantId === catalogPlantId)
      )
      .map((list) => list.id);
  };

  /**
   * Find the UserPlant entry for a catalog plant within a specific list.
   * Returns the listPlant object (which contains userPlant) or undefined.
   */
  const getListPlantForCatalogPlant = (listId, catalogPlantId) => {
    const list = lists.find((l) => l.id === listId);
    return list?.listPlants?.find((lp) => lp.userPlant?.catalogPlantId === catalogPlantId);
  };

  return {
    lists,
    loading,
    createList,
    updateList,
    deleteList,
    addUserPlantToList,
    removeUserPlantFromList,
    getListsForPlant,
    getListPlantForCatalogPlant,
    refetch: fetchLists,
  };
}
