// PlantFormDialog.jsx - Dialog for adding/editing African violets with expandable fields
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

const habitOptions = [
  'Standard',
  'Semiminiature',
  'Miniature',
  'Large',
  'Small Standard',
  'Trailer',
  'Standard Trailer',
  'Semiminiature Trailer',
  'Miniature Trailer',
  'Saintpaulia species'
];

export default function PlantFormDialog({ open, plant, onClose, onSubmit }) {
  const isEditing = Boolean(plant);
  
  const [formData, setFormData] = useState({
    name: '',
    regNum: '',
    regDate: '',
    hybridizer: '',
    habit: '',
    blossom: '',
    foliage: '',
    altReg: '',
    vintage: '',
    engTrans: '',
    alias: '',
    imageUrl: ''
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (plant) {
      setFormData({
        name: plant.name || '',
        regNum: plant.regNum || '',
        regDate: plant.regDate || '',
        hybridizer: plant.hybridizer || '',
        habit: plant.habit || '',
        blossom: plant.blossom || '',
        foliage: plant.foliage || '',
        altReg: plant.altReg || '',
        vintage: plant.vintage || '',
        engTrans: plant.engTrans || '',
        alias: plant.alias || '',
        imageUrl: plant.imageUrl || ''
      });
    } else {
      setFormData({
        name: '',
        regNum: '',
        regDate: '',
        hybridizer: '',
        habit: '',
        blossom: '',
        foliage: '',
        altReg: '',
        vintage: '',
        engTrans: '',
        alias: '',
        imageUrl: ''
      });
    }
  }, [plant, open]);

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  const handleImageUpload = () => {
    if (!window.cloudinary) {
      alert('Cloudinary not loaded. Make sure the script is in index.html');
      return;
    }

    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: 'YOUR_CLOUD_NAME', // Replace with your cloud name
        uploadPreset: 'YOUR_UPLOAD_PRESET', // Replace with your preset
        folder: 'african-violets',
        sources: ['local', 'camera'],
        multiple: false,
        maxFileSize: 10000000,
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        cropping: true,
        croppingAspectRatio: 1.5,
        showSkipCropButton: false
      },
      (error, result) => {
        if (error) {
          console.error('Upload error:', error);
          setUploading(false);
          return;
        }
        
        if (result && result.event === 'success') {
          setFormData(prev => ({ ...prev, imageUrl: result.info.secure_url }));
          setUploading(false);
        }
      }
    );
    
    setUploading(true);
    widget.open();
  };

  const handleSubmit = () => {
    if (!formData.name) {
      alert('Please fill in at least the cultivar name');
      return;
    }

    if (isEditing) {
      onSubmit({ ...formData, id: plant.id });
    } else {
      onSubmit(formData);
    }
    
    setFormData({
      name: '',
      regNum: '',
      regDate: '',
      hybridizer: '',
      habit: '',
      blossom: '',
      foliage: '',
      altReg: '',
      vintage: '',
      engTrans: '',
      alias: '',
      imageUrl: ''
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEditing ? 'Edit Cultivar' : 'Add Cultivar to Catalog'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Cultivar Name"
            value={formData.name}
            onChange={handleChange('name')}
            required
            fullWidth
            helperText="e.g., Aca's Lady Jane or Зимова Казка"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="AVSA Registration Number"
              value={formData.regNum}
              onChange={handleChange('regNum')}
              fullWidth
              helperText="e.g., 5037"
            />
            
            <TextField
              label="Registration Date"
              value={formData.regDate}
              onChange={handleChange('regDate')}
              fullWidth
              helperText="e.g., 1982-08-12"
            />
          </Box>

          <TextField
            label="Hybridizer"
            value={formData.hybridizer}
            onChange={handleChange('hybridizer')}
            fullWidth
            helperText="e.g., J. Brownlie, F. Tinari"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
            <TextField
              select
              label="Habit"
              value={formData.habit}
              onChange={handleChange('habit')}
              fullWidth
            >
              <MenuItem value="">
                <em>Select habit</em>
              </MenuItem>
              {habitOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Vintage"
              value={formData.vintage}
              onChange={handleChange('vintage')}
              fullWidth
              helperText="Year"
            />
          </Box>

          <TextField
            label="Blossom Description"
            value={formData.blossom}
            onChange={handleChange('blossom')}
            multiline
            rows={2}
            fullWidth
            helperText="e.g., Semidouble pink."
          />

          <TextField
            label="Foliage Description"
            value={formData.foliage}
            onChange={handleChange('foliage')}
            multiline
            rows={2}
            fullWidth
            helperText="e.g., Plain, quilted."
          />

          {/* Expandable section for additional fields */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Additional Information (Optional)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="English Translation"
                  value={formData.engTrans}
                  onChange={handleChange('engTrans')}
                  fullWidth
                  helperText="For non-English names, e.g., 'Winter Fairy Tale'"
                />

                <TextField
                  label="Alias / Alternative Name"
                  value={formData.alias}
                  onChange={handleChange('alias')}
                  fullWidth
                  helperText="Other names this cultivar is known by"
                />

                <TextField
                  label="Alternative Registration"
                  value={formData.altReg}
                  onChange={handleChange('altReg')}
                  fullWidth
                  helperText="e.g., CA 288, 1983"
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Violet Photo
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
              <Button
                variant="outlined"
                onClick={handleImageUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </Button>
              {formData.imageUrl && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    component="img"
                    src={formData.imageUrl}
                    alt="Preview"
                    sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="success.main">
                    ✓ Photo uploaded
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Or paste an image URL below
            </Typography>
          </Box>

          <TextField
            label="Image URL"
            value={formData.imageUrl}
            onChange={handleChange('imageUrl')}
            fullWidth
            helperText="Alternative: Paste a link to a photo"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color={isEditing ? 'primary' : 'success'}>
          {isEditing ? 'Save Changes' : 'Add to Catalog'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}