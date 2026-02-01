/**
 * PublicProfilePage - View a user's public profile
 *
 * Displays user info, social links, and public lists.
 * Respects privacy settings.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Avatar,
  Chip,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Instagram,
  Facebook,
  Twitter,
  Language,
  LocationOn,
  Email,
  Edit,
  Lock,
  CalendarMonth,
  LocalFlorist,
} from '@mui/icons-material';
import { useProfile } from '../hooks/useProfile';

export default function PublicProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { fetchPublicProfile } = useProfile();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      const data = await fetchPublicProfile(username);
      if (data) {
        setProfile(data);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    };

    loadProfile();
  }, [username, fetchPublicProfile]);

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Get initials for avatar
  const getInitials = () => {
    const name = profile?.displayName || '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (notFound) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <Lock sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Profile Not Found
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          This user doesn't exist or their profile is private.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Back to Catalog
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Profile Header */}
      <Paper sx={{ p: 4, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <Avatar
            src={profile.image}
            sx={{ width: 120, height: 120, fontSize: '2.5rem' }}
          >
            {getInitials()}
          </Avatar>

          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h4">
                {profile.displayName}
              </Typography>
              {profile.isOwnProfile && (
                <Tooltip title="Edit profile">
                  <IconButton size="small" onClick={() => navigate('/settings')}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              @{profile.username}
            </Typography>

            {profile.bio && (
              <Typography variant="body1" sx={{ mb: 2 }}>
                {profile.bio}
              </Typography>
            )}

            {/* Meta info */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, color: 'text.secondary' }}>
              {profile.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn fontSize="small" />
                  <Typography variant="body2">{profile.location}</Typography>
                </Box>
              )}

              {profile.website && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Language fontSize="small" />
                  <Typography
                    variant="body2"
                    component="a"
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: 'primary.main', textDecoration: 'none' }}
                  >
                    {new URL(profile.website).hostname}
                  </Typography>
                </Box>
              )}

              {profile.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Email fontSize="small" />
                  <Typography variant="body2">{profile.email}</Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarMonth fontSize="small" />
                <Typography variant="body2">
                  Joined {formatDate(profile.createdAt)}
                </Typography>
              </Box>
            </Box>

            {/* Social Links */}
            {(profile.socialInstagram || profile.socialFacebook || profile.socialTwitter) && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                {profile.socialInstagram && (
                  <Tooltip title={`@${profile.socialInstagram}`}>
                    <IconButton
                      component="a"
                      href={`https://instagram.com/${profile.socialInstagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                    >
                      <Instagram />
                    </IconButton>
                  </Tooltip>
                )}
                {profile.socialFacebook && (
                  <Tooltip title="Facebook">
                    <IconButton
                      component="a"
                      href={profile.socialFacebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                    >
                      <Facebook />
                    </IconButton>
                  </Tooltip>
                )}
                {profile.socialTwitter && (
                  <Tooltip title={`@${profile.socialTwitter}`}>
                    <IconButton
                      component="a"
                      href={`https://twitter.com/${profile.socialTwitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                    >
                      <Twitter />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Public Lists */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Public Lists
      </Typography>

      {profile.lists && profile.lists.length > 0 ? (
        <Grid container spacing={2}>
          {profile.lists.map((list) => (
            <Grid item xs={12} sm={6} md={4} key={list.id}>
              <Card>
                <CardActionArea
                  onClick={() => navigate(`/list/${list.id}`)}
                  sx={{ p: 2 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1,
                        bgcolor: list.color || 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LocalFlorist sx={{ color: 'white' }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap>
                        {list.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {list.plantCount} {list.plantCount === 1 ? 'plant' : 'plants'}
                      </Typography>
                    </Box>
                  </Box>
                  {list.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {list.description}
                    </Typography>
                  )}
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {profile.isOwnProfile
              ? "You haven't made any lists public yet."
              : "This user hasn't shared any public lists."}
          </Typography>
          {profile.isOwnProfile && (
            <Button
              variant="outlined"
              sx={{ mt: 2 }}
              onClick={() => navigate('/settings')}
            >
              Manage Lists
            </Button>
          )}
        </Paper>
      )}
    </Container>
  );
}
