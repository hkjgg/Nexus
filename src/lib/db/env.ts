/**
 * Environment access for server-side code.
 *
 * Reading through these helpers keeps the failure mode obvious: a missing
 * variable throws with the name of the variable and where to set it, instead
 * of surfacing later as an opaque connection error.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : undefined;
}

export const hasDatabaseUrl = (): boolean => optionalEnv('DATABASE_URL') !== undefined;
