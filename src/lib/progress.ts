export const PROGRESS_STATUSES = ['planning', 'in_progress', 'review', 'done'] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  planning: 'Planning',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export function isProgressStatus(value: unknown): value is ProgressStatus {
  return typeof value === 'string' && (PROGRESS_STATUSES as readonly string[]).includes(value);
}
