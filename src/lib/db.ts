import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL_POOLED) {
  throw new Error('DATABASE_URL_POOLED is not set. Add it to .env.local');
}

// Always use the pooled connection string in API routes — it's serverless-safe.
const sql = neon(process.env.DATABASE_URL_POOLED);

export const db = drizzle(sql, { schema });
