import { requireStudentTitleAccess } from './student-title-access';
import { and, eq } from 'drizzle-orm';
import { titles } from '@/lib/schema';
import { selectTitleBy } from '@/lib/titles-query';
import { jsonError } from '@/lib/helpers';
import { projectRequirementsError, projectApprovalError } from '@/lib/project-readiness';
export async function requireStudentProjectReady(titleId: string, classId: string, studentId: string) {
  const title = await selectTitleBy(and(eq(titles.id, titleId), eq(titles.classId, classId))!);
  if (!title) return jsonError('Title not found', 404);
  const accessError = await requireStudentTitleAccess(title, { classId, studentId });
  if (accessError) return accessError;
  const approvalError = projectApprovalError(title);
  if (approvalError) return jsonError(approvalError, 403);
  const error = projectRequirementsError(title);
  return error ? jsonError(error, 428) : null;
}
