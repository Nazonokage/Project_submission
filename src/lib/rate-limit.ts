import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import { professorOtps, rateLimits } from './schema';
import { jsonError } from './helpers';
import { isSchemaDrift } from './pg-errors';

const OTP_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX = 5;

export async function assertOtpRateLimit(email: string) {
  const since = new Date(Date.now() - OTP_WINDOW_MS);
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(professorOtps)
      .where(and(eq(professorOtps.email, email), gte(professorOtps.createdAt, since)));
    if (Number(row?.n ?? 0) >= OTP_MAX) {
      return jsonError('Too many login codes for this email. Try again in 15 minutes.', 429);
    }
  } catch (err) {
    if (!isSchemaDrift(err)) console.error('OTP rate limit check failed', err);
  }
  return null;
}

export async function assertActionRateLimit(opts: {
  key: string;
  action: string;
  max: number;
  windowMs?: number;
  message: string;
}) {
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const since = new Date(Date.now() - windowMs);
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(rateLimits)
      .where(
        and(eq(rateLimits.key, opts.key), eq(rateLimits.action, opts.action), gte(rateLimits.createdAt, since))
      );
    if (Number(row?.n ?? 0) >= opts.max) {
      return jsonError(opts.message, 429);
    }
    await db.insert(rateLimits).values({ key: opts.key, action: opts.action });
  } catch (err) {
    if (!isSchemaDrift(err)) console.error('Action rate limit check failed', err);
  }
  return null;
}
