/**
 * Loads .env.local (then .env) for scripts run outside Next.js.
 *
 * Next.js loads these automatically; plain `tsx` scripts do not, so every
 * script imports this module first.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) config({ path, quiet: true });
}
