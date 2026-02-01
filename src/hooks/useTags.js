/**
 * useTags - Custom hook for fetching tag data
 *
 * Tags are used to categorize plants by attributes like color, bloom type, etc.
 * This hook fetches tags from the API, optionally filtered by category.
 */

import { useState, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3001/api';

export function useTags(category = null) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch tags from the API
   * @param {string|null} category - Optional category to filter by (e.g., 'color')
   */
  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const params = category ? `?category=${category}` : '';
      const response = await fetch(`${API_URL}/tags${params}`);
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  }, [category]);

  // Fetch tags on mount and when category changes
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags,
    loading,
    refetch: fetchTags,
  };
}
