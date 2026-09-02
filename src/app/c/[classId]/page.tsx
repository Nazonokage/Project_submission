'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FolderKanban } from 'lucide-react';
import { StudentHeader } from '@/components/student/student-header';
import { EmptyState } from '@/components/student/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Slot = {
  id: string;
  label: string;
  groupSize: number;
  deadline: string | null;
  locked: boolean;
};

export default function StudentClassHomePage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [className, setClassName] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [slotsRes, classRes] = await Promise.all([
        fetch('/api/student/slots'),
        fetch(`/api/student/class-info?classId=${classId}`),
      ]);
      if (slotsRes.status === 401) {
        router.push(`/c/${classId}/login`);
        return;
      }
      if (slotsRes.ok) {
        setSlots((await slotsRes.json()).slots);
      } else {
        setError('Could not load project slots.');
      }
      if (classRes.ok) {
        const data = await classRes.json();
        setClassName(data.class?.name ?? null);
        setTerm(data.class?.term ?? null);
      }
      setLoading(false);
    })();
  }, [classId, router]);

  async function logout() {
    await fetch('/api/student/logout', { method: 'POST' });
    router.push(`/c/${classId}/login`);
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <StudentHeader
        title={className || 'Your class'}
        subtitle={term ? `${term} · Pick a project slot` : 'Pick a project slot'}
        onLogout={logout}
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : slots.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No project slots yet"
          description="Check back once your professor adds a slot for this class."
        />
      ) : (
        <div className="grid gap-3">
          {slots.map((s) => (
            <Link key={s.id} href={`/c/${classId}/${s.id}`}>
              <Card className="rounded-xl shadow-sm hover:border-primary/40 transition-colors">
                <CardContent className="pt-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.label}</p>
                    <p className="text-sm text-muted">
                      {s.groupSize === 1 ? 'Solo' : `Groups of ${s.groupSize}`}
                      {s.deadline ? ` · due ${new Date(s.deadline).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.locked && <Badge variant="destructive">Locked</Badge>}
                    <span className="text-muted text-sm">Open →</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
