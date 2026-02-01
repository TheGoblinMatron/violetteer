// ListView.jsx - Display plants in a specific list
import { Container, Grid, Typography, Box, IconButton, TextField, Button, Chip } from '@mui/material';
import { Close, Edit, Save, Cancel, Public, Lock, Settings, Add } from '@mui/icons-material';
import { useState } from 'react';
import PlantCard from './PlantCard';
import CreateListDialog from './CreateListDialog';
import AddPlantToListDialog from './AddPlantToListDialog';

export default function ListView({ list, allPlants, onRemoveFromList, onUpdateNotes, onAddToList, onUpdateList, onCreatePlant, lists, allPlantsLoading }) {
  const [editingNotes, setEditingNotes] = useState({});
  const [notesValues, setNotesValues] = useState({});
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddPlantDialog, setShowAddPlantDialog] = useState(false);

  // Note: allPlantsLoading is passed to AddPlantToListDialog for showing
  // a loading state in the autocomplete. The list content itself (from
  // list.listPlants) is already loaded via the lists API.

  if (!list || !list.listPlants) {
    return (
      <Container maxWidth="lg">
        <Typography variant="h5" color="text.secondary">
          List not found
        </Typography>
      </Container>
    );
  }

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

  const handleUpdateList = async (listData) => {
    await onUpdateList(listData);
    setShowEditDialog(false);
  };

  const handleAddPlantClick = () => {
    setShowAddPlantDialog(true);
  };

  const handleAddExisting = async (listId, plantId) => {
    await onAddToList(listId, plantId);
  };

  const handleCreateNew = async (plantData, listId) => {
    await onCreatePlant(plantData, listId);
  };

  if (list.listPlants.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h5" color="text.secondary">
                {list.name}
              </Typography>
              <Chip
                icon={list.isPublic ? <Public fontSize="small" /> : <Lock fontSize="small" />}
                label={list.isPublic ? 'Public' : 'Private'}
                size="small"
                variant="outlined"
                color={list.isPublic ? 'primary' : 'default'}
              />
              <IconButton
                size="small"
                onClick={() => setShowEditDialog(true)}
                title="Edit list settings"
              >
                <Settings fontSize="small" />
              </IconButton>
            </Box>
            {list.description && (
              <Typography variant="body2" color="text.secondary">
                {list.description}
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            color="success"
            startIcon={<Add />}
            onClick={handleAddPlantClick}
          >
            Add Plants
          </Button>
        </Box>

        <Typography variant="body1" color="text.secondary">
          This list is empty. Add some plants to get started!
        </Typography>

        {/* Edit List Dialog */}
        <CreateListDialog
          open={showEditDialog}
          list={list}
          onClose={() => setShowEditDialog(false)}
          onSubmit={handleUpdateList}
        />

        {/* Add Plant Dialog */}
        <AddPlantToListDialog
          open={showAddPlantDialog}
          listId={list.id}
          allPlants={allPlants}
          allPlantsLoading={allPlantsLoading}
          onClose={() => setShowAddPlantDialog(false)}
          onAddExisting={handleAddExisting}
          onCreateNew={handleCreateNew}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography variant="h5" color="text.secondary">
              {list.name} ({list.listPlants.length})
            </Typography>
            <Chip
              icon={list.isPublic ? <Public fontSize="small" /> : <Lock fontSize="small" />}
              label={list.isPublic ? 'Public' : 'Private'}
              size="small"
              variant="outlined"
              color={list.isPublic ? 'primary' : 'default'}
            />
            <IconButton 
              size="small"
              onClick={() => setShowEditDialog(true)}
              title="Edit list settings"
            >
              <Settings fontSize="small" />
            </IconButton>
          </Box>
          {list.description && (
            <Typography variant="body2" color="text.secondary">
              {list.description}
            </Typography>
          )}
        </Box>
        
        <Button
          variant="contained"
          color="success"
          startIcon={<Add />}
          onClick={handleAddPlantClick}
        >
          Add Plants
        </Button>
      </Box>

      <Grid container spacing={2}>
        {list.listPlants.map((listPlant) => (
          <Grid item xs={12} sm={6} md={4} key={listPlant.id}>
            <Box>
              <PlantCard
                plant={listPlant.plant}
                isOwned={false}
                isWishlisted={false}
                onRemove={() => onRemoveFromList(list.id, listPlant.plantId)}
                showActions={false}
                showRemove={true}
              />

              {/* Personal notes section - compact */}
              <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                {editingNotes[listPlant.id] ? (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={notesValues[listPlant.id] || ''}
                      onChange={(e) => setNotesValues({ ...notesValues, [listPlant.id]: e.target.value })}
                      placeholder="Add notes..."
                      size="small"
                      sx={{ mb: 0.5 }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleSaveNotes(list.id, listPlant.plantId, listPlant.id)}
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
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ flex: 1, fontStyle: listPlant.notes ? 'normal' : 'italic' }}
                    >
                      {listPlant.notes || 'No notes'}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => handleStartEditNotes(listPlant.id, listPlant.notes)}
                      sx={{ p: 0.25, ml: 0.5 }}
                    >
                      <Edit sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Edit List Dialog */}
      <CreateListDialog
        open={showEditDialog}
        list={list}
        onClose={() => setShowEditDialog(false)}
        onSubmit={handleUpdateList}
      />

      {/* Add Plant Dialog */}
      <AddPlantToListDialog
        open={showAddPlantDialog}
        listId={list.id}
        allPlants={allPlants}
        allPlantsLoading={allPlantsLoading}
        onClose={() => setShowAddPlantDialog(false)}
        onAddExisting={handleAddExisting}
        onCreateNew={handleCreateNew}
      />
    </Container>
  );
}