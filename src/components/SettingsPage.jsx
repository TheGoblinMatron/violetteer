/**
 * SettingsPage - User profile settings
 *
 * Allows authenticated users to edit their profile information,
 * social links, and privacy settings.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Avatar,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  InputAdornment,
  Snackbar,
} from '@mui/material';
import {
  Person,
  Instagram,
  Facebook,
  Twitter,
  Language,
  LocationOn,
  Check,
  Close,
  Groups,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import AvatarUpload from './AvatarUpload';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { profile, loading, error, saving, updateProfile, checkUsername, refetch } = useProfile();

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: '',
    location: '',
    website: '',
    socialInstagram: '',
    socialFacebook: '',
    socialTwitter: '',
    profileIsPublic: true,
    showEmail: false,
    isAvsaMember: false,
    localClub: '',
    otherAffiliation: '',
  });

  // Username validation
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null });
  const [usernameTimeout, setUsernameTimeout] = useState(null);

  // Success message
  const [showSuccess, setShowSuccess] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, loading, navigate]);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        socialInstagram: profile.socialInstagram || '',
        socialFacebook: profile.socialFacebook || '',
        socialTwitter: profile.socialTwitter || '',
        profileIsPublic: profile.profileIsPublic ?? true,
        showEmail: profile.showEmail ?? false,
        isAvsaMember: profile.isAvsaMember ?? false,
        localClub: profile.localClub || '',
        otherAffiliation: profile.otherAffiliation || '',
      });
    }
  }, [profile]);

  // Handle input changes
  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Special handling for username - check availability
    if (field === 'username') {
      const username = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      setFormData((prev) => ({ ...prev, username }));

      // Debounce username check
      if (usernameTimeout) clearTimeout(usernameTimeout);

      if (username && username !== profile?.username) {
        setUsernameStatus({ checking: true, available: null });
        const timeout = setTimeout(async () => {
          const result = await checkUsername(username);
          setUsernameStatus({ checking: false, available: result.available });
        }, 500);
        setUsernameTimeout(timeout);
      } else if (username === profile?.username) {
        setUsernameStatus({ checking: false, available: true });
      } else {
        setUsernameStatus({ checking: false, available: null });
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await updateProfile(formData);
    if (result) {
      setShowSuccess(true);
    }
  };

  // Get initials for avatar
  const getInitials = () => {
    const name = formData.displayName || profile?.name || user?.email || '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Profile Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Profile
          </Typography>

          {/* Avatar Upload */}
          <Box sx={{ mb: 3 }}>
            <AvatarUpload
              currentImage={profile?.image}
              displayName={formData.displayName || profile?.name}
              onUploadSuccess={() => {
                // Refetch profile to get updated image
                refetch();
              }}
            />
          </Box>

          <TextField
            fullWidth
            label="Display Name"
            value={formData.displayName}
            onChange={handleChange('displayName')}
            placeholder={profile?.name || 'Your display name'}
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Username"
            value={formData.username}
            onChange={handleChange('username')}
            placeholder="your_username"
            margin="normal"
            helperText={
              formData.username
                ? `Your profile URL: /user/${formData.username}`
                : 'Choose a unique username for your profile URL'
            }
            InputProps={{
              startAdornment: <InputAdornment position="start">@</InputAdornment>,
              endAdornment: formData.username && (
                <InputAdornment position="end">
                  {usernameStatus.checking ? (
                    <CircularProgress size={20} />
                  ) : usernameStatus.available === true ? (
                    <Check color="success" />
                  ) : usernameStatus.available === false ? (
                    <Close color="error" />
                  ) : null}
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Bio"
            value={formData.bio}
            onChange={handleChange('bio')}
            placeholder="Tell us about yourself and your violet collection..."
            margin="normal"
            multiline
            rows={3}
          />

          <TextField
            fullWidth
            label="Location"
            value={formData.location}
            onChange={handleChange('location')}
            placeholder="City, State"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LocationOn fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Website"
            value={formData.website}
            onChange={handleChange('website')}
            placeholder="https://yourwebsite.com"
            margin="normal"
            type="url"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Language fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Paper>

        {/* Social Links Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Social Links
          </Typography>

          <TextField
            fullWidth
            label="Instagram"
            value={formData.socialInstagram}
            onChange={handleChange('socialInstagram')}
            placeholder="username"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Instagram fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Facebook"
            value={formData.socialFacebook}
            onChange={handleChange('socialFacebook')}
            placeholder="https://facebook.com/yourprofile"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Facebook fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Twitter / X"
            value={formData.socialTwitter}
            onChange={handleChange('socialTwitter')}
            placeholder="username"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Twitter fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Paper>

        {/* Memberships Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Memberships & Affiliations
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={formData.isAvsaMember}
                onChange={handleChange('isAvsaMember')}
              />
            }
            label="I am an AVSA member"
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 6, mt: -1, mb: 2 }}>
            African Violet Society of America
          </Typography>

          <TextField
            fullWidth
            label="Local Club"
            value={formData.localClub}
            onChange={handleChange('localClub')}
            placeholder="e.g., Bay Area African Violet Society"
            margin="normal"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Groups fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Other Affiliations"
            value={formData.otherAffiliation}
            onChange={handleChange('otherAffiliation')}
            placeholder="Other plant societies or groups you belong to"
            margin="normal"
            multiline
            rows={2}
          />
        </Paper>

        {/* Privacy Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Privacy
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={formData.profileIsPublic}
                onChange={handleChange('profileIsPublic')}
              />
            }
            label="Make my profile public"
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 6, mt: -1 }}>
            When enabled, others can view your profile at /user/{formData.username || 'username'}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={formData.showEmail}
                onChange={handleChange('showEmail')}
              />
            }
            label="Show email on public profile"
            sx={{ mt: 2 }}
          />
          <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 6, mt: -1 }}>
            Display your email address on your public profile page
          </Typography>
        </Paper>

        {/* Save Button */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={saving || (formData.username && usernameStatus.available === false)}
            sx={{ flex: 1 }}
          >
            {saving ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
          {formData.username && (
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate(`/user/${formData.username}`)}
            >
              View Profile
            </Button>
          )}
        </Box>
      </form>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        message="Profile saved successfully!"
      />
    </Container>
  );
}
