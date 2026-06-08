// CreateListDialog.jsx - Dialog for creating new lists
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControlLabel,
  Switch
} from '@mui/material';

const colorOptions = [
  { name: 'Green', value: '#4caf50' },
  { name: 'Blue', value: '#2196f3' },
  { name: 'Purple', value: '#9c27b0' },
  { name: 'Pink', value: '#e91e63' },
  { name: 'Orange', value: '#ff9800' },
  { name: 'Red', value: '#f44336' },
  { name: 'Teal', value: '#009688' },
  { name: 'Indigo', value: '#3f51b5' },
];

export default function CreateListDialog({ open, list, onClose, onSubmit, onDelete }) {
  const isEditing = Boolean(list);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#4caf50',
    isPublic: false
  });

  useEffect(() => {
    if (list) {
      // Editing existing list
      setFormData({
        name: list.name || '',
        description: list.description || '',
        color: list.color || '#4caf50',
        isPublic: list.isPublic || false
      });
    } else if (!open) {
      // Reset form when dialog closes
      setFormData({
        name: '',
        description: '',
        color: '#4caf50',
        isPublic: false
      });
      setConfirmingDelete(false);
    }
  }, [open, list]);

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete(list.id);
    setConfirmingDelete(false);
    onClose();
  };

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  const handleTogglePublic = (event) => {
    setFormData({ ...formData, isPublic: event.target.checked });
  };

  const handleColorSelect = (color) => {
    setFormData({ ...formData, color });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('Please enter a list name');
      return;
    }

    if (isEditing) {
      onSubmit({ ...formData, id: list.id });
    } else {
      onSubmit(formData);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditing ? 'Edit List' : 'Create New List'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="List Name"
            value={formData.name}
            onChange={handleChange('name')}
            required
            fullWidth
            helperText="e.g., 'Planted May 2025', 'Grooming for Show'"
            autoFocus
          />
          
          <TextField
            label="Description (Optional)"
            value={formData.description}
            onChange={handleChange('description')}
            multiline
            rows={2}
            fullWidth
            helperText="A brief description of this list"
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.isPublic}
                onChange={handleTogglePublic}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2">
                  Public List
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formData.isPublic 
                    ? 'Other users can view this list' 
                    : 'Only you can see this list'}
                </Typography>
              </Box>
            }
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              List Color
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {colorOptions.map((color) => (
                <Box
                  key={color.value}
                  onClick={() => handleColorSelect(color.value)}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1,
                    bgcolor: color.value,
                    cursor: 'pointer',
                    border: formData.color === color.value ? '3px solid black' : '2px solid transparent',
                    '&:hover': {
                      opacity: 0.8
                    }
                  }}
                  title={color.name}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        {isEditing && onDelete && !list?.isDefault && (
          <Button
            onClick={handleDelete}
            color="error"
            variant={confirmingDelete ? 'contained' : 'text'}
            sx={{ mr: 'auto' }}
          >
            {confirmingDelete ? 'Confirm Delete' : 'Delete List'}
          </Button>
        )}
        <Button onClick={() => { setConfirmingDelete(false); onClose(); }}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color={isEditing ? 'primary' : 'success'}>
          {isEditing ? 'Save Changes' : 'Create List'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}