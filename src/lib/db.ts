import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL_POOLED) {
  throw new Error('DATABASE_URL_POOLED is not set. Add it to .env.local');
}

// Resilient fetch wrapper with retry for Neon cold starts and transient connection timeouts.
// When Neon's serverless compute wakes from suspend, the first TLS connection can exceed
// Node's default 10s undici connect timeout. Retrying once Neon is warming up avoids 500 errors.
const resilientFetch: typeof fetch = async (input, init) => {
  const maxRetries = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err: any) {
      lastError = err;
      const isConnectTimeout =
        err?.name === 'ConnectTimeoutError' ||
        err?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err?.message?.includes('fetch failed') ||
        err?.message?.includes('timeout');

      if (attempt < maxRetries && isConnectTimeout) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

neonConfig.fetchFunction = resilientFetch;

// Always use the pooled connection string in API routes — it's serverless-safe.
const sql = neon(process.env.DATABASE_URL_POOLED);

export const db = drizzle(sql, { schema });
