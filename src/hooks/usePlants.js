/**
 * usePlants - Custom hook for managing the plant catalog
 *
 * This hook handles:
 * - Fetching PAGINATED plants from the catalog (public, no auth required)
 * - Fetching all plants for autocomplete (user's plants + catalog)
 * - Adding new plants to the catalog
 * - Updating existing plants
 * - Deleting plants
 *
 * PAGINATION:
 * The catalog is paginated because we have 5,000+ plants. Loading all
 * at once would be slow. Instead, we load 50 at a time and let users
 * navigate through pages.
 *
 * WHY TWO FETCHES?
 * 1. catalogPlants - Paginated, for browsing the catalog UI
 * 2. allPlants - All plants, for autocomplete/search in dialogs
 *
 * Later optimization: Make autocomplete server-side too.
 */

import { useState, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3001/api';

export function usePlants() {
  // Paginated catalog data
  const [catalogPlants, setCatalogPlants] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // All plants for autocomplete (lazy-loaded when needed)
  const [allPlants, setAllPlants] = useState([]);
  const [allPlantsLoading, setAllPlantsLoading] = useState(false);
  const [allPlantsFetched, setAllPlantsFetched] = useState(false);

  const [loading, setLoading] = useState(true);

  /**
   * Fetch a specific page of catalog plants
   *
   * @param {number} page - Which page to fetch (1-indexed)
   * @param {string|string[]} filters - Optional search term(s)
   *   Can be a single string or an array of strings.
   *   Multiple filters are AND'd together (must match all).
   * @param {string} sortBy - Sort order: 'name', 'popularity', or 'recent'
   * @param {string[]} tags - Optional tag names to filter by (e.g., ['pink', 'blue'])
   *
   * WHY useCallback?
   * Without it, this function would be recreated on every render,
   * which would cause useEffect to re-run unnecessarily.
   */
  const fetchCatalogPage = useCallback(async (page = 1, filters = [], sortBy = 'popularity', tags = [], hasPhotosOnly = false) => {
    try {
      // Normalize filters to array
      const filterArray = Array.isArray(filters) ? filters : (filters ? [filters] : []);
      const tagArray = Array.isArray(tags) ? tags : (tags ? [tags] : []);

      // Build URL with query parameters
      // Multiple filters are joined with commas for the backend
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        sortBy,
        ...(filterArray.length > 0 && { search: filterArray.join(',') }),
        ...(tagArray.length > 0 && { tags: tagArray.join(',') }),
        ...(hasPhotosOnly && { hasPhotos: 'true' }),
      });

      const response = await fetch(`${API_URL}/plants?${params}`);
      const data = await response.json();

      // Update state with paginated data
      setCatalogPlants(data.plants);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch (error) {
      console.error('Error fetching catalog page:', error);
    }
  }, []);

  /**
   * Fetch all plants for autocomplete (lazy-loaded)
   *
   * OPTIMIZATION: This is now called only when needed (e.g., when opening
   * the "Add Plant" dialog) rather than on every page load. This prevents
   * loading 5,000+ plants on initial app load.
   *
   * The data is cached - once fetched, subsequent calls return immediately.
   */
  const fetchAllPlants = useCallback(async () => {
    // Skip if already fetched or currently fetching
    if (allPlantsFetched || allPlantsLoading) {
      return;
    }

    setAllPlantsLoading(true);
    try {
      const response = await fetch(`${API_URL}/plants/all`, {
        credentials: 'include',
      });
      const plants = await response.json();
      setAllPlants(plants);
      setAllPlantsFetched(true);
    } catch (error) {
      console.error('Error fetching all plants:', error);
    } finally {
      setAllPlantsLoading(false);
    }
  }, [allPlantsFetched, allPlantsLoading]);

  /**
   * Initial fetch - load first page of catalog only
   *
   * OPTIMIZATION: We no longer fetch all plants on initial load.
   * The allPlants data is lazy-loaded when needed (e.g., when the user
   * opens the "Add Plant" dialog or navigates to a list view).
   */
  const fetchPlants = useCallback(async () => {
    setLoading(true);
    try {
      await fetchCatalogPage(1);
    } finally {
      setLoading(false);
    }
  }, [fetchCatalogPage]);

  // Fetch plants on mount
  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  /**
   * Update an existing plant
   *
   * @param {Object} plantData - Plant fields including id
   */
  const updatePlant = async (plantData) => {
    try {
      const response = await fetch(`${API_URL}/plants/${plantData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plantData),
      });

      if (!response.ok) {
        throw new Error('Failed to update plant');
      }

      const updatedPlant = await response.json();

      // Update local state
      setCatalogPlants((prev) =>
        prev.map((p) => (p.id === updatedPlant.id ? updatedPlant : p))
      );
      setAllPlants((prev) =>
        prev.map((p) => (p.id === updatedPlant.id ? updatedPlant : p))
      );
    } catch (error) {
      console.error('Error updating plant:', error);
    }
  };

  /**
   * Delete a plant from the catalog
   *
   * @param {number} plantId
   */
  const deletePlant = async (plantId) => {
    try {
      const response = await fetch(`${API_URL}/plants/${plantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete plant');
      }

      // Remove from local state
      setCatalogPlants((prev) => prev.filter((p) => p.id !== plantId));
      setAllPlants((prev) => prev.filter((p) => p.id !== plantId));
    } catch (error) {
      console.error('Error deleting plant:', error);
    }
  };

  /**
   * Get a single plant by ID
   *
   * @param {number} plantId
   * @returns {Object|undefined} The plant or undefined if not found
   */
  const getPlantById = (plantId) => {
    return catalogPlants.find((p) => p.id === plantId);
  };

  return {
    // State
    catalogPlants,
    allPlants,
    loading,
    allPlantsLoading,    // True while fetching all plants for autocomplete

    // Pagination state and controls
    pagination,          // { page, limit, total, totalPages }
    fetchCatalogPage,    // (page, search) => void - fetch a specific page

    // Lazy-loading
    fetchAllPlants,      // Call this when you need allPlants data

    // CRUD operations
    updatePlant,
    deletePlant,

    // Helpers
    getPlantById,
    refetch: fetchPlants,
  };
}
