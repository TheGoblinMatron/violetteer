/**
 * PublicProfilePage - View a user's public profile
 *
 * 3-column layout:
 * - Left: Avatar and contact info
 * - Center: Bio, details, social links, memberships
 * - Right: Stats and public lists
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
  Card,
  CardActionArea,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
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
  Groups,
  Badge,
  PhotoCamera,
  RateReview,
  FormatListBulleted,
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
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (notFound) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
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

  // Fixed widths for sidebars (in pixels)
  const sidebarWidth = 250;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* DESKTOP LAYOUT - 3 columns with sticky sidebars */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3 }}>
        {/* LEFT COLUMN - Avatar & Contact Info (Sticky) */}
        <Box
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              position: 'sticky',
              top: 100, // Below the header
            }}
          >
            <Paper sx={{ p: 3, textAlign: 'center' }}>
            {/* Avatar */}
            <Avatar
              src={profile.image}
              sx={{ width: 150, height: 150, fontSize: '3rem', mx: 'auto', mb: 2 }}
            >
              {getInitials()}
            </Avatar>

            {/* Name & Username */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
              <Typography variant="h5">
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
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              @{profile.username}
            </Typography>

            <Divider sx={{ my: 2 }} />

            {/* Contact Info */}
            <Box sx={{ textAlign: 'left' }}>
              {profile.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: 'text.secondary' }}>
                  <LocationOn fontSize="small" />
                  <Typography variant="body2">{profile.location}</Typography>
                </Box>
              )}

              {profile.website && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Language fontSize="small" color="action" />
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: 'text.secondary' }}>
                  <Email fontSize="small" />
                  <Typography variant="body2">{profile.email}</Typography>
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <CalendarMonth fontSize="small" />
                <Typography variant="body2">
                  Joined {formatDate(profile.createdAt)}
                </Typography>
              </Box>
            </Box>
          </Paper>
          </Box>
        </Box>

        {/* CENTER COLUMN - Bio, Details, Social Links, Memberships (Expands) */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Bio */}
          {profile.bio && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                About
              </Typography>
              <Typography variant="body1">
                {profile.bio}
              </Typography>
            </Paper>
          )}

          {/* Social Links */}
          {(profile.socialInstagram || profile.socialFacebook || profile.socialTwitter) && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Social
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {profile.socialInstagram && (
                  <Tooltip title={`@${profile.socialInstagram}`}>
                    <IconButton
                      component="a"
                      href={`https://instagram.com/${profile.socialInstagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                    >
                      <Twitter />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Paper>
          )}

          {/* Memberships */}
          {(profile.isAvsaMember || profile.localClub || profile.otherAffiliation) && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Memberships
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {profile.isAvsaMember && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Badge fontSize="small" color="primary" />
                    <Typography variant="body2">AVSA Member</Typography>
                  </Box>
                )}
                {profile.localClub && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Groups fontSize="small" color="action" />
                    <Typography variant="body2">{profile.localClub}</Typography>
                  </Box>
                )}
                {profile.otherAffiliation && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {profile.otherAffiliation}
                  </Typography>
                )}
              </Box>
            </Paper>
          )}

          {/* Empty state for center column */}
          {!profile.bio && !profile.socialInstagram && !profile.socialFacebook && !profile.socialTwitter && !profile.isAvsaMember && !profile.localClub && !profile.otherAffiliation && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {profile.isOwnProfile
                  ? "Add a bio, social links, or memberships in Settings to tell others about yourself."
                  : "This user hasn't added any details yet."}
              </Typography>
              {profile.isOwnProfile && (
                <Button
                  variant="outlined"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/settings')}
                >
                  Edit Profile
                </Button>
              )}
            </Paper>
          )}
        </Box>

        {/* RIGHT COLUMN - Stats & Public Lists (Sticky) */}
        <Box
          sx={{
            width: sidebarWidth + 50, // Slightly wider for lists
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              position: 'sticky',
              top: 100, // Below the header
            }}
          >
          {/* Stats */}
          {profile.stats && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Stats
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Chip
                  icon={<LocalFlorist />}
                  label={`Growing ${profile.stats.totalPlants} violet${profile.stats.totalPlants !== 1 ? 's' : ''}`}
                  color="success"
                  variant="outlined"
                  sx={{ justifyContent: 'flex-start' }}
                />
                {profile.stats.publicLists > 0 && (
                  <Chip
                    icon={<FormatListBulleted />}
                    label={`${profile.stats.publicLists} public list${profile.stats.publicLists !== 1 ? 's' : ''}`}
                    variant="outlined"
                    sx={{ justifyContent: 'flex-start' }}
                  />
                )}
                {profile.stats.photosContributed > 0 && (
                  <Chip
                    icon={<PhotoCamera />}
                    label={`${profile.stats.photosContributed} photo${profile.stats.photosContributed !== 1 ? 's' : ''}`}
                    variant="outlined"
                    sx={{ justifyContent: 'flex-start' }}
                  />
                )}
                {profile.stats.reviewsWritten > 0 && (
                  <Chip
                    icon={<RateReview />}
                    label={`${profile.stats.reviewsWritten} review${profile.stats.reviewsWritten !== 1 ? 's' : ''}`}
                    variant="outlined"
                    sx={{ justifyContent: 'flex-start' }}
                  />
                )}
              </Box>
            </Paper>
          )}

          {/* Public Lists */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Public Lists
            </Typography>

            {profile.lists && profile.lists.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {profile.lists.map((list) => (
                  <Card key={list.id} variant="outlined">
                    <CardActionArea
                      onClick={() => navigate(`/list/${list.id}`)}
                      sx={{ p: 2 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            bgcolor: list.color || 'grey.300',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <LocalFlorist sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap>
                            {list.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {list.plantCount} {list.plantCount === 1 ? 'plant' : 'plants'}
                          </Typography>
                        </Box>
                      </Box>
                      {list.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            mt: 1,
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {list.description}
                        </Typography>
                      )}
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {profile.isOwnProfile
                    ? "You haven't made any lists public yet."
                    : "No public lists."}
                </Typography>
                {profile.isOwnProfile && (
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={() => navigate('/settings')}
                  >
                    Manage Lists
                  </Button>
                )}
              </Box>
            )}
          </Paper>
          </Box>
        </Box>
      </Box>

      {/* MOBILE LAYOUT - Stack all columns */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {/* Mobile: Avatar & Contact */}
        <Paper sx={{ p: 3, textAlign: 'center', mb: 3 }}>
          <Avatar
            src={profile.image}
            sx={{ width: 120, height: 120, fontSize: '2.5rem', mx: 'auto', mb: 2 }}
          >
            {getInitials()}
          </Avatar>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography variant="h5">
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            @{profile.username}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'left' }}>
            {profile.location && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: 'text.secondary' }}>
                <LocationOn fontSize="small" />
                <Typography variant="body2">{profile.location}</Typography>
              </Box>
            )}
            {profile.website && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Language fontSize="small" color="action" />
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: 'text.secondary' }}>
                <Email fontSize="small" />
                <Typography variant="body2">{profile.email}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <CalendarMonth fontSize="small" />
              <Typography variant="body2">
                Joined {formatDate(profile.createdAt)}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Mobile: Stats */}
        {profile.stats && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Stats
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip
                icon={<LocalFlorist />}
                label={`Growing ${profile.stats.totalPlants} violet${profile.stats.totalPlants !== 1 ? 's' : ''}`}
                color="success"
                variant="outlined"
                size="small"
              />
              {profile.stats.publicLists > 0 && (
                <Chip
                  icon={<FormatListBulleted />}
                  label={`${profile.stats.publicLists} list${profile.stats.publicLists !== 1 ? 's' : ''}`}
                  variant="outlined"
                  size="small"
                />
              )}
              {profile.stats.photosContributed > 0 && (
                <Chip
                  icon={<PhotoCamera />}
                  label={`${profile.stats.photosContributed} photo${profile.stats.photosContributed !== 1 ? 's' : ''}`}
                  variant="outlined"
                  size="small"
                />
              )}
              {profile.stats.reviewsWritten > 0 && (
                <Chip
                  icon={<RateReview />}
                  label={`${profile.stats.reviewsWritten} review${profile.stats.reviewsWritten !== 1 ? 's' : ''}`}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </Paper>
        )}

        {/* Mobile: Bio */}
        {profile.bio && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              About
            </Typography>
            <Typography variant="body1">
              {profile.bio}
            </Typography>
          </Paper>
        )}

        {/* Mobile: Social Links */}
        {(profile.socialInstagram || profile.socialFacebook || profile.socialTwitter) && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Social
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {profile.socialInstagram && (
                <IconButton component="a" href={`https://instagram.com/${profile.socialInstagram}`} target="_blank">
                  <Instagram />
                </IconButton>
              )}
              {profile.socialFacebook && (
                <IconButton component="a" href={profile.socialFacebook} target="_blank">
                  <Facebook />
                </IconButton>
              )}
              {profile.socialTwitter && (
                <IconButton component="a" href={`https://twitter.com/${profile.socialTwitter}`} target="_blank">
                  <Twitter />
                </IconButton>
              )}
            </Box>
          </Paper>
        )}

        {/* Mobile: Memberships */}
        {(profile.isAvsaMember || profile.localClub || profile.otherAffiliation) && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Memberships
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {profile.isAvsaMember && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Badge fontSize="small" color="primary" />
                  <Typography variant="body2">AVSA Member</Typography>
                </Box>
              )}
              {profile.localClub && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Groups fontSize="small" color="action" />
                  <Typography variant="body2">{profile.localClub}</Typography>
                </Box>
              )}
              {profile.otherAffiliation && (
                <Typography variant="body2" color="text.secondary">
                  {profile.otherAffiliation}
                </Typography>
              )}
            </Box>
          </Paper>
        )}

        {/* Mobile: Public Lists */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Public Lists
          </Typography>
          {profile.lists && profile.lists.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {profile.lists.map((list) => (
                <Card key={list.id} variant="outlined">
                  <CardActionArea onClick={() => navigate(`/list/${list.id}`)} sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          bgcolor: list.color || 'grey.300',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <LocalFlorist sx={{ color: 'white', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap>
                          {list.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {list.plantCount} {list.plantCount === 1 ? 'plant' : 'plants'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              {profile.isOwnProfile ? "You haven't made any lists public yet." : "No public lists."}
            </Typography>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
