'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Title = {
  id: string;
  text: string;
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  members: string[];
};

export default function VerifiedTitlesPage() {
  const { classId, slotId } = useParams<{ classId: string; slotId: string }>();
  const [titles, setTitles] = useState<Title[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(query: string) {
    setLoading(true);
    const qs = new URLSearchParams({ slotId, ...(query ? { q: query } : {}) });
    const res = await fetch(`/api/student/titles/verified?${qs}`);
    if (res.ok) setTitles((await res.json()).titles);
    setLoading(false);
  }

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId]);

  useEffect(() => {
    const handle = setTimeout(() => load(q), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link href={`/c/${classId}/${slotId}`} className="text-sm text-muted hover:underline">
          ← Back to your project
        </Link>
        <h1 className="text-xl font-semibold mt-1">Verified titles</h1>
      </div>

      <input
        className="input"
        placeholder="Search by title, description, tech stack, or target users…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : titles.length === 0 ? (
        <p className="text-sm text-muted">No verified titles yet.</p>
      ) : (
        <div className="grid gap-3">
          {titles.map((t) => (
            <div key={t.id} className="card space-y-2">
              <p className="font-medium">{t.text}</p>
              <p className="text-sm text-muted">{t.description}</p>
              {t.techStack && t.techStack.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {t.techStack.map((tag) => (
                    <span key={tag} className="badge bg-gray-100 text-ink">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {t.targetUsers && <p className="text-sm text-muted">Target users: {t.targetUsers}</p>}
              <p className="text-xs text-muted">By: {t.members.join(', ')}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
