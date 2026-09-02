'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function StudentHeader({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  onLogout,
  actions,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  onLogout?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        {backHref && (
          <Link href={backHref} className="text-sm text-muted hover:text-foreground hover:underline">
            ← {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onLogout && (
          <Button type="button" variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        )}
      </div>
    </div>
  );
}
