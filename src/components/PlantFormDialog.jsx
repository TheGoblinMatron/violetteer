// PlantFormDialog.jsx - Dialog for adding/editing African violets with expandable fields
import { useState, useEffect, useRef } from 'react';
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
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  Link
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

export default function PlantFormDialog({ open, plant, onClose, onSubmit, onImageUploaded }) {
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
    alias: ''
  });

  const [uploading, setUploading] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState('');
  const [affirmedOwnWork, setAffirmedOwnWork] = useState(false);
  const fileInputRef = useRef(null);

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
        alias: plant.alias || ''
      });
      setAffirmedOwnWork(false);
      setUploadedPhotoUrl('');
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
        alias: ''
      });
      setAffirmedOwnWork(false);
      setUploadedPhotoUrl('');
    }
  }, [plant, open]);

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For new plants, we need to save first to get an ID
    if (!isEditing) {
      alert('Please save the cultivar first, then edit it to add a photo.');
      return;
    }

    setUploading(true);

    try {
      const uploadData = new FormData();
      uploadData.append('photo', file);
      uploadData.append('affirmedOwnWork', 'true');

      const response = await fetch(`http://localhost:3001/api/plants/${plant.id}/photos/upload`, {
        method: 'POST',
        credentials: 'include',
        body: uploadData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadedPhotoUrl(result.thumbnailUrl || result.imageUrl);
      if (onImageUploaded) {
        onImageUploaded(result);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
      alias: ''
    });
    setAffirmedOwnWork(false);
    setUploadedPhotoUrl('');
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
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !isEditing || !affirmedOwnWork}
              >
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </Button>
              {!isEditing && (
                <Typography variant="caption" color="text.secondary">
                  Save first to enable photo upload
                </Typography>
              )}
              {uploadedPhotoUrl && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    component="img"
                    src={uploadedPhotoUrl}
                    alt="Preview"
                    sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="success.main">
                    ✓ Photo uploaded
                  </Typography>
                </Box>
              )}
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={affirmedOwnWork}
                  onChange={(e) => setAffirmedOwnWork(e.target.checked)}
                />
              }
              label="I took this photo myself and I'm granting Violetteer permission to display it on this site."
              sx={{ alignItems: 'flex-start', mt: 1 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
              Didn't take this photo yourself? We accept historical and permissioned photos through
              our curators. Email <Link href="mailto:hello@violetteer.com">hello@violetteer.com</Link> to contribute.
            </Typography>
          </Box>
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