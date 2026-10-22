import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy apps/backend/.env.example to apps/backend/.env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  /** Deriv symbol notation, e.g. frxXAUUSD for Gold/USD. No API key needed — see README. */
  instrument: process.env.INSTRUMENT ?? 'frxXAUUSD',
  port: Number(process.env.PORT ?? 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  /** Session cookies are marked Secure (HTTPS-only) in production. */
  isProduction: process.env.NODE_ENV === 'production',
  /** Bootstrapped at startup with the SUPERADMIN role (see ensureSuperAdmin). */
  superAdminEmail: process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || null,
  /** Only used when that account doesn't exist yet. */
  superAdminPassword: process.env.SUPERADMIN_PASSWORD || null,
  /** AI strategy: the key never leaves the server. Without it the strategy can't be switched on. */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
  aiModel: process.env.AI_MODEL?.trim() || 'claude-sonnet-5-5',
  /** Pause between two analyses while no position is open. */
  aiIntervalSec: Math.max(20, Number(process.env.AI_INTERVAL_SEC ?? 60)),
};
