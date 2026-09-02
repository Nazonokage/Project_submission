'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LeaveRequestsPanel, type LeaveRequestRow } from '@/components/dashboard/leave-requests-panel';

type Title = {
  id: string;
  text: string;
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  status: 'pending' | 'verified' | 'rejected';
  members: { id: string; name: string; idNumber: string }[];
  repoUrl: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-warn',
  verified: 'bg-green-100 text-ok',
  rejected: 'bg-red-100 text-danger',
};

export default function VerificationQueuePage() {
  const { classId, slotId } = useParams<{ classId: string; slotId: string }>();
  const [titles, setTitles] = useState<Title[]>([]);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | ''>('pending');
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);

  async function load() {
    setLoading(true);
    const qs = filter ? `?status=${filter}` : '';
    const [titlesRes, leavesRes] = await Promise.all([
      fetch(`/api/dashboard/${classId}/${slotId}/titles${qs}`),
      fetch(`/api/classes/${classId}/leave-requests?status=pending&slotId=${slotId}`),
    ]);
    if (titlesRes.ok) setTitles((await titlesRes.json()).titles);
    if (leavesRes.ok) setLeaveRequests((await leavesRes.json()).requests || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, slotId, filter]);

  async function decide(titleId: string, decision: 'verified' | 'rejected') {
    await fetch(`/api/dashboard/titles/${titleId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        comment: decision === 'rejected' ? comments[titleId] : undefined,
      }),
    });
    load();
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link href={`/dashboard/${classId}`} className="text-sm text-muted hover:underline">
          ← Back to class
        </Link>
        <h1 className="text-xl font-semibold mt-1">Verification queue</h1>
      </div>

      {leaveRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Leave requests awaiting confirmation
          </h2>
          <LeaveRequestsPanel requests={leaveRequests} onChanged={load} compact />
        </section>
      )}

      <div className="flex gap-2">
        {(['pending', 'verified', 'rejected', ''] as const).map((s) => (
          <button
            key={s || 'all'}
            className={`btn-secondary ${filter === s ? 'bg-accent text-white border-accent' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : titles.length === 0 ? (
        <p className="text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="grid gap-3">
          {titles.map((t) => (
            <div key={t.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{t.text}</p>
                  <p className="text-sm text-muted mt-0.5">{t.description}</p>
                </div>
                <span className={`badge ${STATUS_STYLES[t.status]}`}>{t.status}</span>
              </div>
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
              <p className="text-sm text-muted">
                Group: {t.members.map((m) => m.name).join(', ') || '—'}
              </p>
              {t.repoUrl && (
                <p className="text-sm">
                  Repo:{' '}
                  <a className="text-accent hover:underline" href={t.repoUrl} target="_blank">
                    {t.repoUrl}
                  </a>
                </p>
              )}
              {t.status === 'pending' && (
                <div className="space-y-2 pt-1">
                  <input
                    className="input"
                    placeholder="Optional reject comment (shown to the group)"
                    value={comments[t.id] || ''}
                    onChange={(e) => setComments((cur) => ({ ...cur, [t.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={() => decide(t.id, 'verified')}>
                      Approve
                    </button>
                    <button className="btn-danger" onClick={() => decide(t.id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
