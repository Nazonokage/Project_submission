'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

export default function SlotRedirectPage() {
  const { classId, slotId } = useParams<{ classId: string; slotId: string }>();
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const highlight = search.get('highlight');
    const tab = search.get('tab') || 'board';
    const qs = new URLSearchParams({ tab, slot: slotId });
    if (highlight) qs.set('highlight', highlight);
    router.replace(`/dashboard/${classId}?${qs.toString()}`);
  }, [classId, slotId, router, search]);

  return <p className="text-sm text-muted px-6 py-10">Opening board…</p>;
}
