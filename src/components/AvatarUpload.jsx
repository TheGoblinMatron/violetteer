/**
 * AvatarUpload - Component for uploading and managing avatar images
 *
 * Features:
 * - Click to upload
 * - Preview before upload
 * - Delete avatar
 * - Loading states
 */

import { useState, useRef } from 'react';
import {
  Box,
  Avatar,
  IconButton,
  CircularProgress,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  PhotoCamera,
  Delete,
  MoreVert,
} from '@mui/icons-material';

const API_URL = 'http://localhost:3001/api';

export default function AvatarUpload({ currentImage, displayName, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const fileInputRef = useRef(null);

  // Get initials for fallback avatar
  const getInitials = () => {
    const name = displayName || '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  // Handle file selection
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_URL}/users/me/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Notify parent of successful upload
      if (onUploadSuccess) {
        onUploadSuccess(data.image);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle avatar deletion
  const handleDelete = async () => {
    setMenuAnchor(null);
    setUploading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/users/me/avatar`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Delete failed');
      }

      // Notify parent
      if (onUploadSuccess) {
        onUploadSuccess(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    setMenuAnchor(null);
    fileInputRef.current?.click();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Avatar with upload overlay */}
      <Box sx={{ position: 'relative' }}>
        <Avatar
          src={currentImage}
          sx={{
            width: 80,
            height: 80,
            fontSize: '1.5rem',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            '&:hover': {
              opacity: 0.8,
            },
          }}
          onClick={handleUploadClick}
        >
          {uploading ? (
            <CircularProgress size={32} color="inherit" />
          ) : (
            getInitials()
          )}
        </Avatar>

        {/* Upload/Menu button */}
        <IconButton
          size="small"
          sx={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': {
              bgcolor: 'grey.100',
            },
          }}
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          disabled={uploading}
        >
          {currentImage ? <MoreVert fontSize="small" /> : <PhotoCamera fontSize="small" />}
        </IconButton>

        {/* Menu for existing avatar */}
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleUploadClick}>
            <PhotoCamera fontSize="small" sx={{ mr: 1 }} />
            {currentImage ? 'Change photo' : 'Upload photo'}
          </MenuItem>
          {currentImage && (
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <Delete fontSize="small" sx={{ mr: 1 }} />
              Remove photo
            </MenuItem>
          )}
        </Menu>
      </Box>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Info text */}
      <Box>
        <Typography variant="body2" color="text.secondary">
          Profile picture
        </Typography>
        {error ? (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Click to {currentImage ? 'change' : 'upload'}. Max 5MB.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
