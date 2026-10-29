import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type BreadcrumbItem = { label: string; href?: string };

export function DashboardBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex min-w-0 max-w-full items-center gap-2">
            {index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
            {item.href && index < items.length - 1
              ? <Link href={item.href} className="min-w-0 break-words rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{item.label}</Link>
              : <span aria-current={index === items.length - 1 ? 'page' : undefined} className="min-w-0 break-words text-foreground">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
