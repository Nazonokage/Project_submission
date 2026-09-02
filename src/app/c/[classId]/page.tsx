'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/student/slots');
      if (res.status === 401) {
        router.push(`/c/${classId}/login`);
        return;
      }
      if (res.ok) {
        setSlots((await res.json()).slots);
      } else {
        setError('Could not load project slots.');
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function logout() {
    await fetch('/api/student/logout', { method: 'POST' });
    router.push(`/c/${classId}/login`);
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your class</h1>
        <button className="btn-secondary" onClick={logout}>
          Log out
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted">
          No project slots have been set up for this class yet — check back once your
          professor adds one.
        </p>
      ) : (
        <div className="grid gap-3">
          {slots.map((s) => (
            <Link
              key={s.id}
              href={`/c/${classId}/${s.id}`}
              className="card flex items-center justify-between hover:border-accent transition-colors"
            >
              <div>
                <p className="font-medium">{s.label}</p>
                <p className="text-sm text-muted">
                  {s.groupSize === 1 ? 'Solo' : `Groups of ${s.groupSize}`}
                  {s.deadline ? ` · due ${new Date(s.deadline).toLocaleDateString()}` : ''}
                  {s.locked ? ' · locked' : ''}
                </p>
              </div>
              <span className="text-muted text-sm">Open →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
