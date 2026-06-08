/**
 * ResetPasswordPage — landing page from the password-reset email link.
 *
 * The token comes in via ?token=xxx query param. User enters a new
 * password (+ confirm); on submit we call auth.resetPassword and on
 * success redirect to home with a success state. Invalid/expired
 * tokens surface a clear error.
 */

import { useState } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import { resetPassword } from '../lib/auth-client';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // No token in URL — link was malformed or the user navigated here directly
  if (!token) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8, px: 2 }}>
        <Card sx={{ maxWidth: 440, width: '100%' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>Reset link missing</Typography>
            <Alert severity="error" sx={{ mt: 2 }}>
              This page needs a reset token to work. Please use the link from your
              password-reset email, or{' '}
              <Link component={RouterLink} to="/forgot-password">request a new link</Link>.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await resetPassword({ newPassword: password, token });
    setLoading(false);

    if (result?.error) {
      setError(result.error.message || 'Could not reset password. The link may have expired.');
      return;
    }

    // Success — send them home with a flag so the AuthDialog can prompt sign-in
    navigate('/?passwordReset=success');
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8, px: 2 }}>
      <Card sx={{ maxWidth: 440, width: '100%' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Choose a new password</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Pick a strong password you don&apos;t use elsewhere.
          </Typography>

          <form onSubmit={handleSubmit}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TextField
              label="New password"
              type="password"
              fullWidth
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="At least 8 characters"
              sx={{ mb: 2 }}
              disabled={loading}
            />
            <TextField
              label="Confirm new password"
              type="password"
              fullWidth
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              sx={{ mb: 2 }}
              disabled={loading}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !password || !confirm}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Reset password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
