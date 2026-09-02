import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GroupStatus, TitleStatus } from './types';

const GROUP: Record<GroupStatus, { label: string; className: string }> = {
  forming: { label: 'Forming', className: 'border-transparent bg-blue-100 text-blue-800' },
  locked: { label: 'Locked', className: 'border-transparent bg-green-100 text-green-800' },
};

const TITLE: Record<TitleStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-transparent bg-amber-100 text-amber-800' },
  verified: { label: 'Verified', className: 'border-transparent bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'border-transparent bg-red-100 text-red-800' },
};

export function StatusBadge({
  kind,
  status,
  extra,
}: {
  kind: 'group' | 'title';
  status: GroupStatus | TitleStatus;
  extra?: string;
}) {
  const meta = kind === 'group' ? GROUP[status as GroupStatus] : TITLE[status as TitleStatus];
  if (!meta) return null;
  return (
    <Badge className={cn(meta.className)}>
      {meta.label}
      {extra ? ` · ${extra}` : ''}
    </Badge>
  );
}
