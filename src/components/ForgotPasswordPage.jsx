/**
 * ForgotPasswordPage — request a password reset email.
 *
 * UX: After submitting, ALWAYS show the same "check your email" message
 * regardless of whether the email exists in the system. This is the
 * standard pattern to avoid leaking account existence to attackers.
 */

import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
import { forgetPassword } from '../lib/auth-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // We don't surface errors back to the user — better-auth returns
    // success even for non-existent emails (good!), but if there's a
    // genuine network error, the UX still claims "check your email"
    // so we don't help attackers distinguish real vs fake addresses.
    await forgetPassword({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    }).catch((err) => {
      // Log for debugging but don't show to user
      console.error('[forgot-password] error:', err);
    });

    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8, px: 2 }}>
        <Card sx={{ maxWidth: 440, width: '100%' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>Check your email</Typography>
            <Alert severity="success" sx={{ mt: 2 }}>
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password
              reset link shortly. The link is valid for 1 hour.
            </Alert>
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              Didn&apos;t get the email? Check your spam folder, or{' '}
              <Link component="button" onClick={() => setSubmitted(false)}>try again</Link>.
            </Typography>
            <Box sx={{ mt: 3 }}>
              <Link component={RouterLink} to="/">Back to Violetteer</Link>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8, px: 2 }}>
      <Card sx={{ maxWidth: 440, width: '100%' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Forgot your password?</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Enter the email address for your account and we&apos;ll send you a link
            to reset your password.
          </Typography>

          <form onSubmit={handleSubmit}>
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
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !email}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Send reset link'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link component={RouterLink} to="/">Back to sign in</Link>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
