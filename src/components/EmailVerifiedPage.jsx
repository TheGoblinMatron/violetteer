/**
 * EmailVerifiedPage — landing page after the user clicks the verification
 * link in their welcome email.
 *
 * Better-auth handles the token verification server-side via the
 * /api/auth/verify-email endpoint. The email link goes to that endpoint
 * with a `callbackURL` query param pointing here. The server verifies
 * the token, signs the user in (we set autoSignInAfterVerification:true
 * in auth config), and redirects here on success.
 *
 * Failure case: if the token is invalid or expired, better-auth still
 * redirects here but with an `error` query param.
 */

import { useEffect } from 'react';
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  Button,
  Link,
} from '@mui/material';

export default function EmailVerifiedPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const errorCode = searchParams.get('error');

  // Auto-redirect to home after a few seconds on success
  useEffect(() => {
    if (!errorCode) {
      const t = setTimeout(() => navigate('/'), 3000);
      return () => clearTimeout(t);
    }
  }, [errorCode, navigate]);

  if (errorCode) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8, px: 2 }}>
        <Card sx={{ maxWidth: 440, width: '100%' }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>Verification failed</Typography>
            <Alert severity="error" sx={{ mt: 2 }}>
              We couldn&apos;t verify your email. The link may have expired or already been used.
            </Alert>
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              Try signing in — if your email isn&apos;t verified yet, you&apos;ll be prompted
              to request a new verification link.
            </Typography>
            <Box sx={{ mt: 3 }}>
              <Button component={RouterLink} to="/" variant="contained">Back to Violetteer</Button>
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
          <Typography variant="h5" gutterBottom>Email verified 🎉</Typography>
          <Alert severity="success" sx={{ mt: 2 }}>
            Your email is confirmed. You&apos;re signed in and will be redirected shortly.
          </Alert>
          <Box sx={{ mt: 3 }}>
            <Link component={RouterLink} to="/">Go to Violetteer now →</Link>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
