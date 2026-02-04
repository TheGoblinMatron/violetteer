/**
 * PlantCatalog.jsx - Browse plants with pagination
 *
 * PAGINATION EXPLAINED:
 * Instead of loading all 5,000+ plants at once (slow!), we load 50 at a time.
 * The user clicks page numbers to navigate through the catalog.
 *
 * HOW IT WORKS:
 * 1. Parent (App.jsx) passes `pagination` object with metadata
 * 2. Parent passes `onPageChange` function to fetch different pages
 * 3. We render MUI's Pagination component
 * 4. When user clicks a page, we call onPageChange(pageNumber)
 * 5. Parent fetches that page and passes new `plants` array
 */
import { useState } from 'react';
import {
  Container,
  Grid,
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Pagination,
  Chip,
  FormControl,
  Select,
  MenuItem,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
  Collapse,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Add, Search, ViewList, ViewHeadline, TuneRounded, ExpandMore, ExpandLess } from '@mui/icons-material';
import PlantFormDialog from './PlantFormDialog';
import PlantCard from './PlantCard';
import { useAuth } from '../context/AuthContext';
import { useTags } from '../hooks/useTags';

export default function PlantCatalog({
  plants,
  lists,
  pagination,      // { page, limit, total, totalPages }
  onPageChange,    // (page, search) => void
  onAddPlant,
  onAddToList,
  onRemoveFromList,
}) {
  const { isAdmin } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Detect mobile viewport for list vs grid view
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // searchInput = what the user is typing (not yet applied)
  // activeFilters = array of search terms currently filtering results (shown as chips)
  const [searchInput, setSearchInput] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);

  // Sort order: 'name' (A-Z), 'popularity' (most collected), 'recent' (recently added to collections)
  const [sortBy, setSortBy] = useState('popularity');

  // Filter to show only plants with photos
  const [hasPhotosOnly, setHasPhotosOnly] = useState(false);

  // Verbose mode for mobile list view (show full description vs just name)
  const [verboseList, setVerboseList] = useState(false);

  // Color tag filters
  const { tags: colorTags } = useTags('color');
  const [selectedTags, setSelectedTags] = useState([]);

  // Advanced search panel visibility
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const handleAddPlant = (newPlant) => {
    onAddPlant(newPlant);
    setShowAddDialog(false);
  };

  // Helper functions for list management
  const isPlantInList = (plantId, listId) => {
    const list = lists.find((l) => l.id === listId);
    return list?.listPlants?.some((lp) => lp.plantId === plantId) || false;
  };

  const handleToggleList = async (plantId, listId) => {
    if (isPlantInList(plantId, listId)) {
      await onRemoveFromList(listId, plantId);
    } else {
      await onAddToList(listId, plantId);
    }
  };

  // Get default lists for quick actions
  const myCollectionList = lists.find((l) => l.name === 'My Collection');
  const wishlistList = lists.find((l) => l.name === 'Wishlist');

  /**
   * Handle page change from Pagination component
   *
   * MUI Pagination passes (event, page) - we only need page.
   * We pass the active filters and sort order so results stay filtered/sorted.
   */
  const handlePageChange = (event, page) => {
    onPageChange(page, activeFilters, sortBy, selectedTags, hasPhotosOnly);
    // Scroll to top when changing pages for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Handle sort order change
   */
  const handleSortChange = (event) => {
    const newSortBy = event.target.value;
    setSortBy(newSortBy);
    onPageChange(1, activeFilters, newSortBy, selectedTags, hasPhotosOnly);  // Reset to page 1 when sorting changes
  };

  /**
   * Toggle a color tag filter
   */
  const handleToggleTag = (tagName) => {
    const newTags = selectedTags.includes(tagName)
      ? selectedTags.filter(t => t !== tagName)
      : [...selectedTags, tagName];
    setSelectedTags(newTags);
    onPageChange(1, activeFilters, sortBy, newTags, hasPhotosOnly);
  };

  /**
   * Toggle "has photos only" filter
   */
  const handleToggleHasPhotos = () => {
    const newValue = !hasPhotosOnly;
    setHasPhotosOnly(newValue);
    onPageChange(1, activeFilters, sortBy, selectedTags, newValue);
  };

  /**
   * Handle search - ADD the search input to active filters
   *
   * When searching, we:
   * 1. Add to the active filters array (shows as chip)
   * 2. Clear the input field (ready for next search)
   * 3. Fetch page 1 with all filters
   *
   * Multiple filters are AND'd together - results must match ALL terms.
   */
  const handleSearch = () => {
    const term = searchInput.trim();
    if (!term) return;

    // Don't add duplicate filters
    if (activeFilters.includes(term)) {
      setSearchInput('');
      return;
    }

    const newFilters = [...activeFilters, term];
    setActiveFilters(newFilters);
    setSearchInput('');  // Clear input after applying
    onPageChange(1, newFilters, sortBy, selectedTags, hasPhotosOnly);
  };

  /**
   * Handle Enter key in search field
   */
  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  /**
   * Remove a specific filter (click X on chip)
   *
   * @param {string} filterToRemove - The filter term to remove
   */
  const handleRemoveFilter = (filterToRemove) => {
    const newFilters = activeFilters.filter(f => f !== filterToRemove);
    setActiveFilters(newFilters);
    onPageChange(1, newFilters, sortBy, selectedTags, hasPhotosOnly);
  };

  /**
   * Clear all filters at once (text filters and color tags)
   */
  const handleClearAllFilters = () => {
    setActiveFilters([]);
    setSelectedTags([]);
    setHasPhotosOnly(false);
    onPageChange(1, [], sortBy, [], false);
  };

  return (
    <>
      <Container maxWidth="lg">
        {/* Header with search */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search plants..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchInput.trim() && (
                <InputAdornment position="end">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSearch}
                  >
                    Add Filter
                  </Button>
                </InputAdornment>
              ),
            }}
          />
          {isAdmin && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<Add />}
              onClick={() => setShowAddDialog(true)}
            >
              Add Plant
            </Button>
          )}
        </Box>

        {/* Advanced Search Toggle */}
        <Box sx={{ mb: 1 }}>
          <Button
            size="small"
            startIcon={<TuneRounded fontSize="small" />}
            endIcon={showAdvancedSearch ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            sx={{
              color: selectedTags.length > 0 ? 'primary.main' : 'text.secondary',
              fontWeight: selectedTags.length > 0 ? 600 : 400,
            }}
          >
            Advanced Search
            {selectedTags.length > 0 && ` (${selectedTags.length})`}
          </Button>
        </Box>

        {/* Collapsible Advanced Search Panel */}
        <Collapse in={showAdvancedSearch}>
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          >
            {/* Color filter chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, minWidth: 50 }}>
                Colors:
              </Typography>
              {colorTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <Chip
                    key={tag.id}
                    label={tag.displayName}
                    size="small"
                    onClick={() => handleToggleTag(tag.name)}
                    sx={{
                      bgcolor: isSelected ? tag.color : 'transparent',
                      color: isSelected
                        ? (tag.name === 'white' || tag.name === 'yellow' || tag.name === 'lavender' ? 'text.primary' : 'white')
                        : 'text.secondary',
                      border: '1px solid',
                      borderColor: tag.color === '#FFFFFF' ? 'grey.400' : tag.color,
                      fontWeight: isSelected ? 600 : 400,
                      '&:hover': {
                        bgcolor: isSelected ? tag.color : `${tag.color}22`,
                      },
                    }}
                  />
                );
              })}
            </Box>

            {/* Has Photos toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={hasPhotosOnly}
                  onChange={handleToggleHasPhotos}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Show only varieties with photos
                </Typography>
              }
              sx={{ mt: 1.5, ml: 0 }}
            />
          </Box>
        </Collapse>

        {/* Sort + Active Filter Chips + Results count */}
        <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
          {/* Sort dropdown */}
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select
              value={sortBy}
              onChange={handleSortChange}
              displayEmpty
              sx={{ fontSize: '0.875rem' }}
            >
              <MenuItem value="name">A–Z</MenuItem>
              <MenuItem value="popularity">Most Popular</MenuItem>
              <MenuItem value="recent">Recently Added</MenuItem>
            </Select>
          </FormControl>

          {/* Verbose/Compact toggle */}
          <Tooltip title={verboseList ? 'Compact view' : 'Verbose view'}>
            <IconButton
              size="small"
              onClick={() => setVerboseList(!verboseList)}
              sx={{ ml: 0.5 }}
            >
              {verboseList ? <ViewList fontSize="small" /> : <ViewHeadline fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {pagination.total.toLocaleString()} plants
            {pagination.totalPages > 1 && ` • Page ${pagination.page}/${pagination.totalPages}`}
          </Typography>
          {activeFilters.map((filter) => (
            <Chip
              key={filter}
              label={filter}
              onDelete={() => handleRemoveFilter(filter)}
              color="primary"
              variant="outlined"
              size="small"
            />
          ))}
          {selectedTags.map((tagName) => {
            const tag = colorTags.find(t => t.name === tagName);
            if (!tag) return null;
            return (
              <Chip
                key={`tag-${tagName}`}
                label={tag.displayName}
                onDelete={() => handleToggleTag(tagName)}
                size="small"
                sx={{
                  bgcolor: tag.color,
                  color: tag.name === 'white' || tag.name === 'yellow' || tag.name === 'lavender' ? 'text.primary' : 'white',
                  border: tag.color === '#FFFFFF' ? '1px solid' : 'none',
                  borderColor: 'grey.400',
                  '& .MuiChip-deleteIcon': {
                    color: tag.name === 'white' || tag.name === 'yellow' || tag.name === 'lavender' ? 'text.secondary' : 'rgba(255,255,255,0.7)',
                    '&:hover': {
                      color: tag.name === 'white' || tag.name === 'yellow' || tag.name === 'lavender' ? 'text.primary' : 'white',
                    },
                  },
                }}
              />
            );
          })}
          {hasPhotosOnly && (
            <Chip
              label="Has photos"
              onDelete={handleToggleHasPhotos}
              size="small"
              color="secondary"
              variant="outlined"
            />
          )}
          {(activeFilters.length > 0 || selectedTags.length > 0 || hasPhotosOnly) && (activeFilters.length + selectedTags.length + (hasPhotosOnly ? 1 : 0) > 1) && (
            <Button size="small" onClick={handleClearAllFilters} sx={{ minHeight: 0, py: 0 }}>
              Clear all
            </Button>
          )}
        </Box>

        {/* Plant List (mobile) or Grid (tablet+) */}
        {isMobile ? (
          // List view for mobile
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, overflow: 'hidden' }}>
            {plants.map((plant) => {
              const inCollection =
                myCollectionList && isPlantInList(plant.id, myCollectionList.id);
              const inWishlist =
                wishlistList && isPlantInList(plant.id, wishlistList.id);

              return (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  variant="listItem"
                  verbose={verboseList}
                  isOwned={inCollection}
                  isWishlisted={inWishlist}
                  onToggleOwned={() =>
                    myCollectionList && handleToggleList(plant.id, myCollectionList.id)
                  }
                  onToggleWishlist={() =>
                    wishlistList && handleToggleList(plant.id, wishlistList.id)
                  }
                  showActions={true}
                />
              );
            })}
          </Box>
        ) : (
          // Grid view for tablet and desktop
          <Grid container spacing={2}>
            {plants.map((plant) => {
              const inCollection =
                myCollectionList && isPlantInList(plant.id, myCollectionList.id);
              const inWishlist =
                wishlistList && isPlantInList(plant.id, wishlistList.id);

              return (
                <Grid item xs={12} sm={6} md={4} key={plant.id}>
                  <PlantCard
                    plant={plant}
                    variant="card"
                    verbose={verboseList}
                    isOwned={inCollection}
                    isWishlisted={inWishlist}
                    onToggleOwned={() =>
                      myCollectionList && handleToggleList(plant.id, myCollectionList.id)
                    }
                    onToggleWishlist={() =>
                      wishlistList && handleToggleList(plant.id, wishlistList.id)
                    }
                    showActions={true}
                  />
                </Grid>
              );
            })}
          </Grid>
        )}

        {/* No results message */}
        {plants.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No cultivars found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try removing some filters or using different search terms
            </Typography>
            {activeFilters.length > 0 && (
              <Button onClick={handleClearAllFilters} sx={{ mt: 2 }}>
                Clear All Filters
              </Button>
            )}
          </Box>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 4,
              mb: 2,
            }}
          >
            <Pagination
              count={pagination.totalPages}  // Total number of pages
              page={pagination.page}          // Current page (controlled)
              onChange={handlePageChange}     // Called when user clicks a page
              color="primary"
              size="large"
              showFirstButton                 // Show "go to first page" button
              showLastButton                  // Show "go to last page" button
            />
          </Box>
        )}
      </Container>

      <PlantFormDialog
        open={showAddDialog}
        plant={null}
        onClose={() => setShowAddDialog(false)}
        onSubmit={handleAddPlant}
      />
    </>
  );
}
