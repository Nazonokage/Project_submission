import { and, eq } from 'drizzle-orm';
import { titles } from '@/lib/schema';
import { selectTitleBy } from '@/lib/titles-query';
import { jsonError } from '@/lib/helpers';
import { projectRequirementsError } from '@/lib/project-readiness';
export async function requireStudentProjectReady(titleId: string, classId: string) {
  const title = await selectTitleBy(and(eq(titles.id, titleId), eq(titles.classId, classId))!);
  if (!title) return jsonError('Title not found', 404);
  const error = projectRequirementsError(title);
  return error ? jsonError(error, 428) : null;
}
