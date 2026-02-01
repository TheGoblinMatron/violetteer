/**
 * AddPlantToListDialog - Quick add plants to a list
 *
 * Allows users to:
 * 1. Search and select from existing catalog plants
 * 2. Search and select from their own custom varieties
 * 3. Create a new custom variety (private to them)
 *
 * Custom varieties are NOT added to the public catalog - they're
 * private to the user. Later, users can request to contribute
 * their custom plant to the catalog for review.
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import { LocalFlorist, Person } from '@mui/icons-material';

export default function AddPlantToListDialog({ open, listId, allPlants, allPlantsLoading, onClose, onAddExisting, onCreateNew }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showingSuggestions, setShowingSuggestions] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setShowingSuggestions(false);
    }
  }, [open]);

  /**
   * Smart search with prioritized results
   *
   * Sorting priority:
   * 1. Exact match (case-insensitive)
   * 2. Starts with the search term
   * 3. Contains the search term
   *
   * This ensures the most relevant results appear first,
   * reducing the chance of accidentally creating duplicates.
   */
  const getFilteredAndSortedPlants = () => {
    if (searchQuery.trim().length === 0) {
      return { suggestions: [], totalMatches: 0, exactMatch: null };
    }

    const query = searchQuery.toLowerCase().trim();

    // Find all matching plants
    const allMatches = allPlants.filter(plant =>
      plant.name.toLowerCase().includes(query)
    );

    // Sort by relevance: exact match > starts with > contains
    const sorted = allMatches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Exact match comes first
      const aExact = aName === query;
      const bExact = bName === query;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // "Starts with" comes before "contains"
      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // Alphabetical within same category
      return aName.localeCompare(bName);
    });

    // Find exact match (if any)
    const exactMatch = sorted.find(plant =>
      plant.name.toLowerCase() === query
    );

    return {
      suggestions: sorted.slice(0, 5),  // Show top 5
      totalMatches: allMatches.length,
      exactMatch,
    };
  };

  const { suggestions, totalMatches, exactMatch } = getFilteredAndSortedPlants();
  const additionalMatches = totalMatches - suggestions.length;

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    setShowingSuggestions(value.trim().length > 0);
  };

  const handleSelectExisting = async (plant) => {
    await onAddExisting(listId, plant.id);
    setSearchQuery('');
    setShowingSuggestions(false);
    onClose();
  };

  const handleCreateNew = () => {
    if (!searchQuery.trim()) {
      alert('Please enter a plant name');
      return;
    }

    // Create a new plant with minimal data
    onCreateNew({
      name: searchQuery.trim()
    }, listId);
    
    setSearchQuery('');
    setShowingSuggestions(false);
    onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      if (exactMatch) {
        // If there's an exact match, add that
        handleSelectExisting(exactMatch);
      } else if (suggestions.length > 0) {
        // If there are suggestions but no exact match, add the first suggestion
        handleSelectExisting(suggestions[0]);
      } else if (searchQuery.trim()) {
        // No matches, create new
        handleCreateNew();
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Add Plant to List</DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="Plant Name"
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          placeholder="Search or create..."
          autoFocus
          sx={{ mt: 1 }}
        />

        {showingSuggestions && (
          <Box sx={{ mt: 1.5 }}>
            {suggestions.length > 0 ? (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {totalMatches === 1
                    ? '1 match'
                    : `${totalMatches} matches${additionalMatches > 0 ? ` (top 5)` : ''}`}
                </Typography>
                <List dense sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, py: 0 }}>
                  {suggestions.map((plant, index) => (
                    <Box key={plant.id}>
                      {index > 0 && <Divider />}
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => handleSelectExisting(plant)} sx={{ py: 0.75 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography variant="body2">{plant.name}</Typography>
                                {!plant.isInCatalog && (
                                  <Chip
                                    label="My Plant"
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ height: 18, '& .MuiChip-label': { px: 0.5, fontSize: '0.65rem' } }}
                                  />
                                )}
                              </Box>
                            }
                            secondary={plant.hybridizer || plant.habit}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    </Box>
                  ))}
                </List>

                {additionalMatches > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    +{additionalMatches} more — refine your search
                  </Typography>
                )}

                {!exactMatch && (
                  <Button
                    size="small"
                    variant="text"
                    color="primary"
                    startIcon={<Person sx={{ fontSize: 16 }} />}
                    onClick={handleCreateNew}
                    sx={{ mt: 1, textTransform: 'none' }}
                  >
                    Create "{searchQuery}" as custom variety
                  </Button>
                )}
              </>
            ) : (
              <Box sx={{ py: 1.5, px: 2, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  No matches found
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<Person sx={{ fontSize: 16 }} />}
                  onClick={handleCreateNew}
                  sx={{ mt: 1 }}
                >
                  Create "{searchQuery}"
                </Button>
              </Box>
            )}
          </Box>
        )}

        {allPlantsLoading && (
          <Box sx={{ mt: 1.5, py: 1, px: 2, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Loading catalog...
            </Typography>
          </Box>
        )}

        {!showingSuggestions && !allPlantsLoading && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Type to search existing plants or create a new entry
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ pt: 0 }}>
        <Button size="small" onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}