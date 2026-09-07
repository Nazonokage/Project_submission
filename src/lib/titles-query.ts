import { and, isNull, type SQL } from 'drizzle-orm';
import { db } from './db';
import { titles } from './schema';
import { isUndefinedColumn } from './pg-errors';

export const TITLE_CORE_COLUMNS = {
  id: titles.id,
  classId: titles.classId,
  slotId: titles.slotId,
  groupId: titles.groupId,
  text: titles.text,
  description: titles.description,
  techStack: titles.techStack,
  targetUsers: titles.targetUsers,
  status: titles.status,
  addedBy: titles.addedBy,
  submittedByStudentId: titles.submittedByStudentId,
  addedByProfId: titles.addedByProfId,
  repoUrl: titles.repoUrl,
  deploymentUrl: titles.deploymentUrl,
  repoLastChecked: titles.repoLastChecked,
  verifiedAt: titles.verifiedAt,
  rejectionReason: titles.rejectionReason,
  documentation: titles.documentation,
  createdAt: titles.createdAt,
  updatedAt: titles.updatedAt,
  updatedByStudentId: titles.updatedByStudentId,
};

function withProgressDefaults<T extends Record<string, unknown>>(row: T) {
  return {
    progressStatus: 'planning',
    lastCommitSha: null,
    lastCommitMessage: null,
    lastCommitAt: null,
    ...row,
  };
}

function withNotDeleted(conditions: SQL | undefined) {
  return conditions ? and(conditions, isNull(titles.deletedAt)) : isNull(titles.deletedAt);
}

export async function selectTitles(conditions: SQL | undefined) {
  try {
    return await db.select().from(titles).where(withNotDeleted(conditions));
  } catch (err) {
    if (!isUndefinedColumn(err)) throw err;
    console.warn('titles PM columns missing; using core columns only. Run add_pm_schema.sql on Neon.');
    const rows = await db.select(TITLE_CORE_COLUMNS).from(titles).where(conditions);
    return rows.map((row) => withProgressDefaults(row));
  }
}

export async function selectTitleBy(conditions: SQL) {
  try {
    const [row] = await db.select().from(titles).where(withNotDeleted(conditions)).limit(1);
    return row ?? null;
  } catch (err) {
    if (!isUndefinedColumn(err)) throw err;
    const [row] = await db.select(TITLE_CORE_COLUMNS).from(titles).where(conditions).limit(1);
    return row ? withProgressDefaults(row) : null;
  }
}

export function titleConditions(parts: (SQL | undefined)[]) {
  const present = parts.filter(Boolean) as SQL[];
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return and(...present);
}
