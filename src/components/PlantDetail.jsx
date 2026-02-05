/**
 * PlantDetail.jsx - Ravelry-inspired plant detail page
 *
 * 3-column layout:
 * - Left: Photo gallery
 * - Center: Plant name, hybridizer, specifications table
 * - Right: Community stats (collections, wishlists) + user's lists with notes
 *
 * Responsive: stacks to single column on mobile
 */
import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  IconButton,
  Chip,
  TextField,
  Grid,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  Add,
  Remove,
  CheckCircle,
  RadioButtonUnchecked,
  LocalFlorist,
  Favorite,
  Collections,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import PlantFormDialog from './PlantFormDialog';
import CreateListDialog from './CreateListDialog';

export default function PlantDetail({
  plants,
  lists,
  onAddToList,
  onRemoveFromList,
  onUpdateNotes,
  onUpdatePlant,
  onDeletePlant,
  onCreateList,
  getListsForPlant,
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState({});
  const [notesValues, setNotesValues] = useState({});
  const [plantDetails, setPlantDetails] = useState(null);

  // Find basic plant from props (for initial render and fallback)
  const basePlant = plants.find((p) => p.id === parseInt(id));

  // Fetch detailed plant data including wishlistCount
  useEffect(() => {
    const fetchPlantDetails = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/plants/${id}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setPlantDetails(data);
        }
      } catch (error) {
        console.error('Error fetching plant details:', error);
      }
    };

    if (id) {
      fetchPlantDetails();
    }
  }, [id]);

  // Merge base plant data with detailed data (detailed takes priority)
  const plant = plantDetails || basePlant;
  const plantListIds = plant ? getListsForPlant(plant.id) : [];

  // Notes editing handlers
  const handleStartEditNotes = (listPlantId, currentNotes) => {
    setEditingNotes({ ...editingNotes, [listPlantId]: true });
    setNotesValues({ ...notesValues, [listPlantId]: currentNotes || '' });
  };

  const handleSaveNotes = async (listId, plantId, listPlantId) => {
    await onUpdateNotes(listId, plantId, notesValues[listPlantId]);
    setEditingNotes({ ...editingNotes, [listPlantId]: false });
  };

  const handleCancelEdit = (listPlantId) => {
    setEditingNotes({ ...editingNotes, [listPlantId]: false });
  };

  // Plant CRUD handlers
  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${plant.name}?`)) {
      onDeletePlant(plant.id);
      navigate('/');
    }
  };

  const handleUpdate = (updatedPlant) => {
    onUpdatePlant(updatedPlant);
    setShowEditDialog(false);
  };

  // List toggle handler
  const handleToggleList = async (listId) => {
    if (plantListIds.includes(listId)) {
      await onRemoveFromList(listId, plant.id);
    } else {
      await onAddToList(listId, plant.id);
    }
  };

  const handleCreateList = async (listData) => {
    const newList = await onCreateList(listData);
    setShowCreateListDialog(false);
    if (newList?.id) {
      await onAddToList(newList.id, plant.id);
    }
  };

  // Check if plant has additional info (excluding alias/engTrans which are shown elsewhere)
  const hasAdditionalInfo = plant?.lineage || plant?.altReg || plant?.vintage;

  /**
   * Get the description for display
   * Uses the pre-computed description from the database if available,
   * otherwise returns just the plant name as fallback.
   */
  const getDescription = () => {
    if (!plant) return '';
    return plant.description || plant.name;
  };

  // Not found state
  if (!plant) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h5" color="text.secondary">
          Cultivar not found
        </Typography>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Catalog
        </Button>
      </Container>
    );
  }

  return (
    <>
      <Container maxWidth="lg">
        {/* Header with back button and actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/')} size="small">
            Back to Catalog
          </Button>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setShowEditDialog(true)} title="Edit">
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={handleDelete} title="Delete">
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* 3-Column Grid Layout */}
        <Grid container spacing={3} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          {/* Column 1: Photo Gallery */}
          <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
            {/* Official Photos - stacked vertically */}
            {plant.featuredPhotos?.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {plant.featuredPhotos.map((url, index) => (
                  <Box
                    key={index}
                    component="img"
                    src={url}
                    alt={`${plant.name} photo ${index + 1}`}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      objectFit: 'cover',
                      borderRadius: 1,
                    }}
                  />
                ))}
              </Box>
            ) : plant.imageUrl ? (
              <Box
                component="img"
                src={plant.imageUrl}
                alt={plant.name}
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 400,
                  objectFit: 'cover',
                  borderRadius: 1,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                }}
              >
                <LocalFlorist sx={{ fontSize: 80, color: 'grey.300' }} />
              </Box>
            )}

            {/* Thumbnail gallery for user photos (if any) */}
            {plant.userPhotos?.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {plant.userPhotos.slice(0, 4).map((photo) => (
                  <Box
                    key={photo.id}
                    component="img"
                    src={photo.thumbnailUrl || photo.imageUrl}
                    alt="User photo"
                    sx={{
                      width: 60,
                      height: 60,
                      objectFit: 'cover',
                      borderRadius: 0.5,
                      cursor: 'pointer',
                      opacity: 0.8,
                      '&:hover': { opacity: 1 },
                    }}
                  />
                ))}
              </Box>
            )}
          </Grid>

          {/* Column 2: Name & Description */}
          <Grid item xs={12} md={5} sx={{ minWidth: 0 }}>
            {/* Plant name & description */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 500, color: 'success.dark' }}>
                {plant.name}
              </Typography>

              {/* Alias and English translation - directly under name */}
              {plant.alias && (
                <Typography variant="body2" color="text.secondary">
                  Also known as: {plant.alias}
                </Typography>
              )}
              {plant.engTrans && (
                <Typography variant="body2" color="text.secondary">
                  English: {plant.engTrans}
                </Typography>
              )}

              {/* Compact description */}
              <Typography variant="body1" sx={{ mt: 2, lineHeight: 1.6, wordWrap: 'break-word' }}>
                {getDescription()}
              </Typography>
            </Paper>

            {/* Additional Information (lineage, altReg, vintage only) */}
            {hasAdditionalInfo && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Additional Information
                </Typography>
                {plant.lineage && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Lineage:</strong> {plant.lineage}
                  </Typography>
                )}
                {plant.altReg && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Alt. Registration:</strong> {plant.altReg}
                  </Typography>
                )}
                {plant.vintage && (
                  <Typography variant="body2">
                    <strong>Vintage:</strong> {plant.vintage}
                  </Typography>
                )}
              </Paper>
            )}

            {/* Tags Section - grouped by category */}
            {plant.plantTags?.length > 0 && (() => {
              // Group tags by category
              const tagsByCategory = plant.plantTags.reduce((acc, plantTag) => {
                const category = plantTag.tag.category;
                if (!acc[category]) acc[category] = [];
                acc[category].push(plantTag);
                return acc;
              }, {});

              // Human-readable category labels
              const categoryLabels = {
                color: 'Blossom Color',
                leaf_color: 'Leaf Color',
                bloom_type: 'Bloom Type',
                foliage: 'Foliage',
                habit: 'Growth Habit',
                size: 'Size',
              };

              return (
                <Paper sx={{ p: 3, mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Tags
                  </Typography>
                  {Object.entries(tagsByCategory).map(([category, plantTags]) => (
                    <Box key={category} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {categoryLabels[category] || category}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {plantTags.map((plantTag) => {
                          const tag = plantTag.tag;
                          // Determine if this is a light color that needs dark text
                          const isLightColor = tag.name === 'white' || tag.name === 'yellow' || tag.name === 'lavender';
                          return (
                            <Chip
                              key={plantTag.id}
                              label={tag.displayName}
                              size="small"
                              sx={{
                                bgcolor: tag.color || 'grey.200',
                                color: isLightColor ? 'text.primary' : (tag.color ? 'white' : 'text.primary'),
                                border: tag.color === '#FFFFFF' ? '1px solid' : 'none',
                                borderColor: 'grey.400',
                                fontWeight: 500,
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Paper>
              );
            })()}
          </Grid>

          {/* Column 3: Community Stats & User Lists */}
          <Grid item xs={12} md={3} sx={{ minWidth: 0, flexShrink: 0 }}>
            {/* Community Stats */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Community
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Collections sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography variant="h6" sx={{ lineHeight: 1 }}>
                  {plant.collectionCount || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {plant.collectionCount === 1 ? 'Collection' : 'Collections'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <Favorite sx={{ color: 'error.main', fontSize: 20 }} />
                <Typography variant="h6" sx={{ lineHeight: 1 }}>
                  {plant.wishlistCount || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wishlisted
                </Typography>
              </Box>

              {plant.extinctionStatus === 'likely_extinct' && (
                <Chip
                  label="Likely Extinct"
                  color="warning"
                  size="small"
                  sx={{ mt: 1.5 }}
                />
              )}
            </Paper>

            {/* User's Lists */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Your Lists
              </Typography>

              {lists.map((list) => {
                const isInList = plantListIds.includes(list.id);
                const listPlant = list.listPlants?.find((lp) => lp.plantId === plant.id);

                return (
                  <Box key={list.id} sx={{ mt: 1.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isInList ? (
                          <CheckCircle sx={{ color: 'success.main', fontSize: 18 }} />
                        ) : (
                          <RadioButtonUnchecked sx={{ color: 'grey.400', fontSize: 18 }} />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isInList ? 500 : 400,
                            color: isInList ? 'text.primary' : 'text.secondary',
                          }}
                        >
                          {list.name}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleList(list.id)}
                        sx={{ p: 0.5 }}
                      >
                        {isInList ? (
                          <Remove fontSize="small" />
                        ) : (
                          <Add fontSize="small" />
                        )}
                      </IconButton>
                    </Box>

                    {/* Inline notes for lists the plant is in */}
                    {isInList && listPlant && (
                      <Box sx={{ ml: 3.5, mt: 0.5 }}>
                        {editingNotes[listPlant.id] ? (
                          <Box>
                            <TextField
                              fullWidth
                              size="small"
                              multiline
                              rows={2}
                              value={notesValues[listPlant.id] || ''}
                              onChange={(e) =>
                                setNotesValues({
                                  ...notesValues,
                                  [listPlant.id]: e.target.value,
                                })
                              }
                              placeholder="Add notes..."
                              sx={{ mb: 0.5 }}
                            />
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() =>
                                  handleSaveNotes(list.id, plant.id, listPlant.id)
                                }
                                sx={{ minWidth: 0, px: 1.5 }}
                              >
                                Save
                              </Button>
                              <Button
                                size="small"
                                onClick={() => handleCancelEdit(listPlant.id)}
                                sx={{ minWidth: 0, px: 1 }}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              cursor: 'pointer',
                              fontStyle: listPlant.notes ? 'normal' : 'italic',
                              '&:hover': { textDecoration: 'underline' },
                            }}
                            onClick={() =>
                              handleStartEditNotes(listPlant.id, listPlant.notes)
                            }
                          >
                            {listPlant.notes || 'Add notes...'}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })}

              <Button
                size="small"
                startIcon={<Add />}
                onClick={() => setShowCreateListDialog(true)}
                sx={{ mt: 2 }}
              >
                Create New List
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Dialogs */}
      <PlantFormDialog
        open={showEditDialog}
        plant={plant}
        onClose={() => setShowEditDialog(false)}
        onSubmit={handleUpdate}
      />

      <CreateListDialog
        open={showCreateListDialog}
        onClose={() => setShowCreateListDialog(false)}
        onSubmit={handleCreateList}
      />
    </>
  );
}
