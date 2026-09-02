import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
