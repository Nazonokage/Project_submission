'use client';
import { useId, useState } from 'react';
import { STATUS_STYLES } from '@/components/dashboard/progress-board';

export type VerificationTitle = {
  id: string; text: string; description: string; status: string; addedBy?: string;
  members: { id: string; name: string }[];
  submittedBy?: { id: string; name: string; role: string } | null;
};
export function VerificationQueue({ titles, onReview, onDecision }: {
  titles: VerificationTitle[];
  onReview: (id: string) => void;
  onDecision: (id: string, decision: 'verified' | 'rejected', comment?: string) => Promise<boolean>;
}) {
  const id = useId();
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const query = search.trim().toLowerCase();
  const filtered = titles.filter(t => (status === 'all' || t.status === status) &&
    [t.text, t.description, t.submittedBy?.name || '', ...t.members.map(m => m.name)].some(text => text.toLowerCase().includes(query)));
  async function decide(titleId: string, decision: 'verified' | 'rejected') {
    if (busy[titleId]) return;
    setBusy(current => ({ ...current, [titleId]: true }));
    try {
      if (await onDecision(titleId, decision, comments[titleId])) setComments(current => ({ ...current, [titleId]: '' }));
    } finally { setBusy(current => ({ ...current, [titleId]: false })); }
  }
  return <section aria-label="Verification queue" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Verification queue <span className="text-sm font-normal text-muted">({titles.filter(t => t.status === 'pending').length} pending)</span></h2>
      <p className="text-xs text-muted">For the selected project slot</p>
    </div>
    <div className="flex flex-col sm:flex-row gap-2">
      <input aria-label="Search verification queue" className="input flex-1" placeholder="Search title, submitter or group member" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Verification status" className="input sm:w-40" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All statuses</option>
      </select>
    </div>
    {filtered.length === 0 ? <p className="text-sm text-muted">{status === 'pending' && !query ? 'All caught up. No titles awaiting verification.' : 'No titles match these filters.'}</p> :
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(t => <article key={t.id} aria-label={t.text} className="card min-w-0 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2"><h3 className="font-medium break-words min-w-0">{t.text}</h3><span className={`badge shrink-0 ${STATUS_STYLES[t.status] || ''}`}>{t.status}</span></div>
        <p className="text-sm text-muted line-clamp-3 break-words">{t.description}</p>
        <p className="text-xs"><span className="text-muted">Submitted by: </span>{t.submittedBy ? `${t.submittedBy.name}${t.submittedBy.role === 'prof' ? ' (Professor)' : ''}` : t.addedBy === 'prof' ? 'Professor (unavailable)' : 'Student (unavailable)'}</p>
        <div><p className="text-xs text-muted mb-1">Group members</p><div className="flex flex-wrap gap-1">{t.members.length ? t.members.map(m => <span key={m.id} className="rounded-full bg-secondary px-2 py-1 text-xs break-words max-w-full">{m.name}</span>) : <span className="text-xs text-muted">No current members</span>}</div></div>
        <div className="mt-auto space-y-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => onReview(t.id)}>Full review</button>
          {t.status === 'pending' && <>
            <label htmlFor={`${id}-${t.id}`} className="label">Rejection comment (optional)</label>
            <textarea id={`${id}-${t.id}`} className="input min-h-16 text-sm" value={comments[t.id] || ''} onChange={e => setComments(current => ({ ...current, [t.id]: e.target.value }))} />
            <div className="flex flex-wrap gap-2"><button disabled={busy[t.id]} className="btn-primary text-sm" onClick={() => decide(t.id, 'verified')}>{busy[t.id] ? 'Saving...' : 'Approve'}</button><button disabled={busy[t.id]} className="btn-danger text-sm" onClick={() => decide(t.id, 'rejected')}>Reject</button></div>
          </>}
        </div>
      </article>)}</div>}
  </section>;
}
