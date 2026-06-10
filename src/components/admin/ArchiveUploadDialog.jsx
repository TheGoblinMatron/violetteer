import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Alert, CircularProgress, Typography, Link,
} from '@mui/material';

const EXAMPLE_NOTES = [
  '"From the collection of [Photographer Name] (d. 2017). Used by permission of his daughter Jane Doe, granted 2024-09."',
  '"Submitted with original AVSA registration filing, 1987. Photographer credited; rights presumed assigned to AVSA."',
  '"CC BY 4.0 — sourced from Flickr user [handle], https://flickr.com/photos/handle/123456. Attribution preserved per license."',
  '"Public domain by age — published in The American Magazine of African Violets, vol. 12, 1962."',
];

export default function ArchiveUploadDialog({ open, onClose, plantId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [photographerName, setPhotographerName] = useState('');
  const [attributionNote, setAttributionNote] = useState('');
  const [caption, setCaption] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFile(null);
    setPhotographerName('');
    setAttributionNote('');
    setCaption('');
    setShowExamples(false);
    setError('');
  };

  const handleClose = () => { if (!loading) { reset(); onClose(); } };

  const canSubmit = file && photographerName.trim() && attributionNote.trim() && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('plantId', String(plantId));
      formData.append('photographerName', photographerName.trim());
      formData.append('attributionNote', attributionNote.trim());
      if (caption.trim()) formData.append('caption', caption.trim());

      const res = await fetch('http://localhost:3001/api/admin/photos/archive', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const photo = await res.json();
      reset();
      onClose();
      onUploaded?.(photo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload archive photo</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Button variant="outlined" component="label" fullWidth sx={{ mb: 2 }} disabled={loading}>
            {file ? file.name : 'Choose image (JPG, PNG, WebP)'}
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Button>

          <TextField
            label="Photographer's name"
            fullWidth required disabled={loading}
            value={photographerName}
            onChange={(e) => setPhotographerName(e.target.value)}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Attribution note"
            fullWidth required multiline rows={3} disabled={loading}
            value={attributionNote}
            onChange={(e) => setAttributionNote(e.target.value)}
            placeholder='e.g., "Used with permission of David Johnson; granted via email 2024-11-15."'
            helperText="License, permission source, or origin"
            sx={{ mb: 1 }}
          />

          <Link
            component="button" type="button" variant="caption"
            onClick={(e) => { e.preventDefault(); setShowExamples(s => !s); }}
            sx={{ display: 'block', mb: 2 }}
          >
            {showExamples ? 'Hide' : 'ⓘ More'} examples
          </Link>
          {showExamples && (
            <Box sx={{ mb: 2, pl: 2, borderLeft: '2px solid', borderColor: 'divider' }}>
              {EXAMPLE_NOTES.map((ex, i) => (
                <Typography key={i} variant="caption" component="div" sx={{ mb: 1, color: 'text.secondary' }}>
                  {ex}
                </Typography>
              ))}
            </Box>
          )}

          <TextField
            label="Caption (optional)"
            fullWidth disabled={loading}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Upload archive photo'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
