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
};
