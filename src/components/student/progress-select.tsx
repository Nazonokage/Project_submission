'use client';

import { PROGRESS_LABELS, PROGRESS_STATUSES, type ProgressStatus } from '@/lib/progress';
import { cn } from '@/lib/utils';

export function ProgressSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value?: string | null;
  onChange: (next: ProgressStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  const current = (PROGRESS_STATUSES as readonly string[]).includes(value || '')
    ? (value as ProgressStatus)
    : 'planning';

  return (
    <select
      className={cn('input py-1 text-xs w-auto min-w-[8.5rem]', className)}
      value={current}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ProgressStatus)}
      aria-label="Progress status"
    >
      {PROGRESS_STATUSES.map((status) => (
        <option key={status} value={status}>
          {PROGRESS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}

export function ProgressPill({ status }: { status?: string | null }) {
  const current = (PROGRESS_STATUSES as readonly string[]).includes(status || '')
    ? (status as ProgressStatus)
    : 'planning';
  const styles: Record<ProgressStatus, string> = {
    planning: 'bg-sand/70 text-ink',
    in_progress: 'bg-accent/15 text-accent',
    review: 'bg-[#F2CC8F]/80 text-ink',
    done: 'bg-sage/30 text-ok',
  };
  return (
    <span className={cn('badge', styles[current])}>{PROGRESS_LABELS[current]}</span>
  );
}
