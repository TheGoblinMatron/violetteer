/**
 * Layout.jsx - Shared header/layout with list navigation
 *
 * Now includes authentication UI:
 * - Login button when not authenticated
 * - User avatar menu when authenticated
 */
import { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Button,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Yard, Add, Person, Logout, Login, Settings, AdminPanelSettings } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import CreateListDialog from './CreateListDialog.jsx';
import AuthDialog from './AuthDialog.jsx';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';

export default function Layout({ children, lists = [], onCreateList }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Auth state
  const { user, isAuthenticated, isAdmin, loading, signOut } = useAuth();
  const { profile } = useProfile();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleTabChange = (event, newValue) => {
    navigate(newValue);
  };

  const handleCreateList = async (listData) => {
    await onCreateList(listData);
    setShowCreateDialog(false);
  };

  // Handle user menu
  const handleUserMenuOpen = (event) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleUserMenuClose();
    await signOut();
    navigate('/'); // Go to catalog after logout
  };

  // Build tabs from lists
  // Only show list tabs when authenticated
  const tabs = [
    { label: 'Browse Plants', value: '/' },
    ...(isAuthenticated ? lists.map(list => ({
      label: list.name,
      value: `/list/${list.id}`
    })) : [])
  ];

  // Only highlight a tab if the current path matches one of the tabs
  // This prevents MUI warnings when on pages like /plant/:id
  const currentTabValue = tabs.some(tab => tab.value === location.pathname)
    ? location.pathname
    : false;

  /**
   * Get user initials for avatar
   * Uses first letter of name, or first letter of email
   */
  const getUserInitials = () => {
    if (!user) return '?';
    if (user.name) return user.name[0].toUpperCase();
    if (user.email) return user.email[0].toUpperCase();
    return '?';
  };

  return (
    <>
      {/* Header - sticky so it stays visible when scrolling */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          {/* Top row: Logo and Auth */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            {/* Logo */}
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={handleLogoClick}
            >
              <Yard sx={{ fontSize: 40, color: 'success.main' }} />
              <Typography variant="h4" component="h1" color="success.dark">
                Violetteer
              </Typography>
            </Box>

            {/* Auth UI */}
            <Box>
              {loading ? (
                <CircularProgress size={24} />
              ) : isAuthenticated ? (
                <>
                  {/* User Avatar - clickable to open menu */}
                  <IconButton onClick={handleUserMenuOpen}>
                    <Avatar
                      src={profile?.image}
                      sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}
                    >
                      {getUserInitials()}
                    </Avatar>
                  </IconButton>

                  {/* User Menu Dropdown */}
                  <Menu
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={handleUserMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <MenuItem
                      onClick={() => {
                        if (profile?.username) {
                          handleUserMenuClose();
                          navigate(`/user/${profile.username}`);
                        }
                      }}
                      sx={{
                        opacity: 1,
                        cursor: profile?.username ? 'pointer' : 'default',
                        '&:hover': {
                          backgroundColor: profile?.username ? undefined : 'transparent',
                        }
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {user?.name || 'User'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user?.email}
                        </Typography>
                      </Box>
                    </MenuItem>
                    <Divider />
                    <MenuItem
                      onClick={() => {
                        handleUserMenuClose();
                        navigate('/settings');
                      }}
                    >
                      <Settings fontSize="small" sx={{ mr: 1 }} />
                      Settings
                    </MenuItem>
                    {isAdmin && (
                      <MenuItem
                        onClick={() => {
                          handleUserMenuClose();
                          navigate('/admin');
                        }}
                      >
                        <AdminPanelSettings fontSize="small" sx={{ mr: 1 }} />
                        Admin Dashboard
                      </MenuItem>
                    )}
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <Logout fontSize="small" sx={{ mr: 1 }} />
                      Sign Out
                    </MenuItem>
                  </Menu>
                </>
              ) : (
                /* Login Button */
                <Button
                  variant="outlined"
                  startIcon={<Login />}
                  onClick={() => setShowAuthDialog(true)}
                >
                  Sign In
                </Button>
              )}
            </Box>
          </Box>

          {/* Navigation Tabs */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tabs value={currentTabValue} onChange={handleTabChange} sx={{ flex: 1 }}>
              {tabs.map((tab) => (
                <Tab key={tab.value} label={tab.label} value={tab.value} />
              ))}
            </Tabs>
            {/* Only show create list button when authenticated */}
            {isAuthenticated && (
              <IconButton
                color="primary"
                onClick={() => setShowCreateDialog(true)}
                title="Create new list"
              >
                <Add />
              </IconButton>
            )}
          </Box>
        </Container>
      </Box>

      {/* Page Content - flex: 1 ensures it fills remaining space */}
      <Box sx={{ flex: 1, py: 3 }}>
        {children}
      </Box>

      {/* Create List Dialog */}
      <CreateListDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateList}
      />

      {/* Auth Dialog (Login/Register) */}
      <AuthDialog
        open={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
      />
    </>
  );
}