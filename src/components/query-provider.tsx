'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-client';
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === '/login' || pathname.endsWith('/login')) client.clear();
  }, [pathname, client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
