/**
 * AuthDialog - Login/Register Modal Component
 *
 * A Material-UI dialog that handles both login and registration.
 * Uses tabs to switch between the two modes.
 *
 * FORM HANDLING PATTERN:
 * 1. Controlled inputs (value + onChange) for form fields
 * 2. Local state for loading/error during submission
 * 3. Call auth functions from context on submit
 * 4. Close dialog on success, show error on failure
 */

import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  Link,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function AuthDialog({ open, onClose }) {
  // Tab state: 0 = Login, 1 = Register
  const [tab, setTab] = useState(0);

  // Form field state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // After successful signup, show "check your email" instead of closing —
  // the user can't sign in until they verify their address.
  const [signedUpEmail, setSignedUpEmail] = useState('');

  // Get auth functions from context
  const { signIn, signUp } = useAuth();

  /**
   * Handle form submission
   *
   * Calls signIn or signUp based on current tab.
   * Better Auth handles password hashing on the server -
   * we just send the plain password over HTTPS.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 0) {
        // Login
        await signIn(email, password);
        // Success - reset form and close
        resetForm();
        onClose();
      } else {
        // Register — does NOT sign user in because email verification
        // is required. Show "check your email" message instead.
        await signUp(email, password, name || email.split('@')[0]);
        setSignedUpEmail(email);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setTab(0);
    setSignedUpEmail('');
  };

  /**
   * Handle dialog close
   */
  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  // Post-signup verify-email view
  if (signedUpEmail) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Check your email</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mt: 1 }}>
            We sent a verification link to <strong>{signedUpEmail}</strong>.
            Click the link in the email to activate your account.
          </Alert>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Didn&apos;t get the email? Check your spam folder. The link expires
            after 24 hours; you can sign up again with the same email if needed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} variant="contained">Got it</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      // Prevent closing by clicking backdrop while loading
      disableEscapeKeyDown={loading}
    >
      {/* Tabs for switching between Login and Register */}
      <DialogTitle sx={{ pb: 0 }}>
        <Tabs
          value={tab}
          onChange={(e, newValue) => {
            setTab(newValue);
            setError(''); // Clear errors when switching tabs
          }}
          centered
        >
          <Tab label="Sign In" />
          <Tab label="Create Account" />
        </Tabs>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Name field - only shown for registration */}
          {tab === 1 && (
            <TextField
              label="Display Name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should we call you?"
              sx={{ mb: 2 }}
              disabled={loading}
            />
          )}

          {/* Email field */}
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
            disabled={loading}
          />

          {/* Password field */}
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText={tab === 1 ? 'At least 8 characters' : ''}
            disabled={loading}
          />

          {/* Forgot password link — only on the sign-in tab */}
          {tab === 0 && (
            <Box sx={{ textAlign: 'right', mt: 1 }}>
              <Link
                component={RouterLink}
                to="/forgot-password"
                onClick={handleClose}
                variant="body2"
              >
                Forgot password?
              </Link>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ minWidth: 100 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : tab === 0 ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
