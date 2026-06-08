/**
 * Email sender — thin wrapper around Resend.
 *
 * Exposes two functions used by better-auth:
 *   sendPasswordReset(toEmail, resetUrl, userName)
 *   sendVerificationEmail(toEmail, verifyUrl, userName)
 *
 * Both return a promise that resolves on success. On failure they log
 * the error but do NOT throw — we don't want a transient email outage
 * to break a signup or reset request from the user's perspective.
 *
 * Dev convenience: if RESEND_API_KEY is missing, emails are logged to
 * the console with the action URL instead of being sent. This lets
 * fresh-cloned dev environments work without needing email config.
 */

import { Resend } from 'resend';

const FROM_ADDRESS = 'Violetteer <noreply@violetteer.com>';
const REPLY_TO = 'hello@violetteer.com';
const APP_NAME = 'Violetteer';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

if (!resend) {
  console.warn(
    '[email] RESEND_API_KEY not set — emails will be logged to console instead of sent. ' +
    'Set RESEND_API_KEY in .env to enable real email delivery.'
  );
}

/**
 * Display name to use in email greeting. Better-auth passes either a
 * user record or just an email; handle both shapes gracefully.
 */
function greetingName(userOrEmail) {
  if (typeof userOrEmail === 'string') return userOrEmail;
  return userOrEmail?.name || userOrEmail?.email || 'there';
}

async function send({ to, subject, html, text }) {
  // Dev fallback: no API key configured
  if (!resend) {
    console.log(`\n=== [email-dev-stub] to=${to} subject=${subject} ===\n${text}\n=== end ===\n`);
    return { ok: true, devStub: true };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      text,
      replyTo: REPLY_TO,
    });
    if (result.error) {
      console.error('[email] Resend returned error:', result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { ok: false, error: err.message };
  }
}

// ============================================================
// Password reset
// ============================================================

export async function sendPasswordReset({ to, resetUrl, user }) {
  const name = greetingName(user || to);
  const subject = `Reset your ${APP_NAME} password`;

  const text = [
    `Hi ${name},`,
    '',
    `Someone requested a password reset for your ${APP_NAME} account.`,
    '',
    'To reset your password, visit this link (valid for 1 hour):',
    resetUrl,
    '',
    `If you didn't request this, you can safely ignore this email — your password won't change.`,
    '',
    `— ${APP_NAME}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; color: #222; line-height: 1.5;">
      <h2 style="color: #6a1b9a;">Reset your ${APP_NAME} password</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Someone requested a password reset for your ${APP_NAME} account.</p>
      <p>
        <a href="${resetUrl}" style="display: inline-block; background: #6a1b9a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset password</a>
      </p>
      <p style="font-size: 13px; color: #666;">Or paste this link into your browser (valid for 1 hour):<br><a href="${resetUrl}" style="color: #6a1b9a; word-break: break-all;">${resetUrl}</a></p>
      <p style="font-size: 13px; color: #666;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;">
      <p style="font-size: 12px; color: #999;">— ${APP_NAME}</p>
    </div>
  `;

  return send({ to, subject, html, text });
}

// ============================================================
// Email verification
// ============================================================

export async function sendVerificationEmail({ to, verifyUrl, user }) {
  const name = greetingName(user || to);
  const subject = `Verify your ${APP_NAME} email`;

  const text = [
    `Hi ${name},`,
    '',
    `Welcome to ${APP_NAME}! Please verify your email address by clicking the link below:`,
    verifyUrl,
    '',
    `If you didn't sign up for ${APP_NAME}, you can safely ignore this email.`,
    '',
    `— ${APP_NAME}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 540px; margin: 0 auto; color: #222; line-height: 1.5;">
      <h2 style="color: #6a1b9a;">Welcome to ${APP_NAME}</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Please verify your email address so we know you can be reached.</p>
      <p>
        <a href="${verifyUrl}" style="display: inline-block; background: #6a1b9a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Verify email</a>
      </p>
      <p style="font-size: 13px; color: #666;">Or paste this link into your browser:<br><a href="${verifyUrl}" style="color: #6a1b9a; word-break: break-all;">${verifyUrl}</a></p>
      <p style="font-size: 13px; color: #666;">If you didn't sign up for ${APP_NAME}, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;">
      <p style="font-size: 12px; color: #999;">— ${APP_NAME}</p>
    </div>
  `;

  return send({ to, subject, html, text });
}

// ============================================================
// Helpers
// ============================================================

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
