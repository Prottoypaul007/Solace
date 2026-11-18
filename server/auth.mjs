import { betterAuth } from 'better-auth';
import { db } from './db.mjs';

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.');
export const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3005';
const secure = baseURL.startsWith('https://');
const origins = (process.env.SOLACE_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map(item => item.trim()).filter(Boolean);

const options = (allowSignUp) => ({
  database: db,
  baseURL,
  secret,
  trustedOrigins: origins,
  emailAndPassword: {
    enabled: true,
    disableSignUp: !allowSignUp,
    minPasswordLength: 12,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 60, customRules: { '/sign-in/email': { window: 60, max: 5 } } },
  advanced: {
    ipAddress: { ipAddressHeaders: ['x-solace-client-ip'] },
    defaultCookieAttributes: { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax' },
  },
});

export const auth = betterAuth(options(false));
// This instance is never mounted as an HTTP handler. Only setup and invitation
// activation call it after their own server-side checks.
export const internalAuth = betterAuth(options(true));
export { origins };
