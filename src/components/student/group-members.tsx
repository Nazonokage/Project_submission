import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Member } from './types';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function GroupMembers({
  members,
  maxSize,
}: {
  members: Member[];
  maxSize?: number;
}) {
  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{initials(m.name) || '?'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{m.name}</p>
            <p className="text-xs text-muted">{m.idNumber}</p>
          </div>
        </li>
      ))}
      {typeof maxSize === 'number' && (
        <p className="text-xs text-muted pt-1">
          {members.length}/{maxSize} members
        </p>
      )}
    </ul>
  );
}
