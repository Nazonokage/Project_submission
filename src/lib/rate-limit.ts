import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { jsonError } from './helpers';

export function rateKey(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

// Separate statements give the counter a fresh READ COMMITTED snapshot after
// the lock is acquired. Neon executes the whole batch as one transaction.
export async function assertActionRateLimit(opts: {
  key: string; action: string; max: number; windowMs?: number; message: string;
}) {
  const since = new Date(Date.now() - (opts.windowMs ?? 15 * 60 * 1000));
  const key = rateKey(opts.key);
  try {
    const result = await db.batch([
      db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key + ':' + opts.action}))`),
      db.execute(sql`INSERT INTO rate_limits (key, action)
        SELECT ${key}, ${opts.action}
        WHERE (SELECT count(*) FROM rate_limits WHERE key = ${key} AND action = ${opts.action} AND created_at >= ${since}) < ${opts.max}
        RETURNING id`),
      db.execute(sql`DELETE FROM rate_limits WHERE key = ${key} AND action = ${opts.action} AND created_at < ${since}`),
    ]);
    return result[1].rows.length ? null : jsonError(opts.message, 429);
  } catch {
    console.error('Rate limit store unavailable');
    return jsonError('Login or action protection is temporarily unavailable. Try again shortly.', 503);
  }
}

export async function assertOtpRateLimit(email: string) {
  const message = 'Too many login codes requested. Try again in 15 minutes.';
  const global = await assertActionRateLimit({ key: 'otp-service', action: 'otp_send', max: 200, message });
  return global || assertActionRateLimit({ key: email, action: 'otp_send', max: 5, message });
}
