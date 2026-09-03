import { db } from './db';
import { activityLog, projectUpdates } from './schema';
import { isSchemaDrift } from './pg-errors';
import { PROGRESS_LABELS, type ProgressStatus } from './progress';

export async function logProgressChange(opts: {
  classId: string;
  slotId: string;
  groupId: string;
  titleId: string;
  actorId: string;
  as: 'student' | 'prof';
  from?: string | null;
  to: ProgressStatus;
}) {
  const label = PROGRESS_LABELS[opts.to];
  const fromLabel = opts.from && opts.from in PROGRESS_LABELS
    ? PROGRESS_LABELS[opts.from as ProgressStatus]
    : opts.from;
  const body = fromLabel ? `Progress changed from ${fromLabel} to ${label}.` : `Progress set to ${label}.`;

  try {
    await db.insert(projectUpdates).values({
      classId: opts.classId,
      slotId: opts.slotId,
      groupId: opts.groupId,
      titleId: opts.titleId,
      postedByStudentId: opts.as === 'student' ? opts.actorId : null,
      postedByProfId: opts.as === 'prof' ? opts.actorId : null,
      kind: 'progress',
      headline: label,
      body,
    });
  } catch (err) {
    if (!isSchemaDrift(err)) console.error('Could not write project update', err);
  }

  try {
    await db.insert(activityLog).values({
      classId: opts.classId,
      actorId: opts.actorId,
      action: 'title.progress_updated',
      targetId: opts.titleId,
    });
  } catch (err) {
    console.error('Could not write activity log', err);
  }
}
