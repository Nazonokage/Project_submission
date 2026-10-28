'use client';
import { useId, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  const lock = useRef(false);
  const [batch, setBatch] = useState<VerificationTitle[] | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [result, setResult] = useState('');
  const query = search.trim().toLowerCase();
  const filtered = titles.filter(t => (status === 'all' || t.status === status) &&
    [t.text, t.description, t.submittedBy?.name || '', ...t.members.map(m => m.name)].some(text => text.toLowerCase().includes(query)));
  async function decide(titleId: string, decision: 'verified' | 'rejected') {
    if (lock.current) return;
    lock.current = true;
    setBusy(current => ({ ...current, [titleId]: true }));
    try {
      if (await onDecision(titleId, decision, comments[titleId])) setComments(current => ({ ...current, [titleId]: '' }));
    } finally { lock.current = false; setBusy(current => ({ ...current, [titleId]: false })); }
  }
  async function approveBatch() {
    if (lock.current || !batch) return;
    lock.current = true;
    setBatchBusy(true);
    let approved = 0;
    const selected = batch;
    try {
      for (const title of selected) {
        try { if (await onDecision(title.id, 'verified')) approved++; } catch { /* Keep failed items pending for retry. */ }
      }
      setResult(`${approved} approved. ${selected.length - approved} could not be approved.`);
      setBatch(null);
    } finally { lock.current = false; setBatchBusy(false); }
  }
  const pending = filtered.filter(t => t.status === 'pending');
  const saving = batchBusy || Object.values(busy).some(Boolean);
  return <section aria-label="Verification queue" className="min-w-0 rounded-2xl border bg-surface p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">Verification queue <span className="text-sm font-normal text-muted">({titles.filter(t => t.status === 'pending').length} pending)</span></h2>
      <button type="button" className="btn-primary text-xs" disabled={saving || pending.length === 0} onClick={() => setBatch([...pending])}>Approve all ({pending.length})</button>
    </div>
    <div className="flex flex-col sm:flex-row gap-2">
      <input aria-label="Search verification queue" className="input flex-1" placeholder="Search title, submitter or group member" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Verification status" className="input sm:w-40" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All statuses</option>
      </select>
    </div>
    {filtered.length === 0 ? <p className="text-sm text-muted">{status === 'pending' && !query ? 'All caught up. No titles awaiting verification.' : 'No titles match these filters.'}</p> :
      <div className="flex gap-3 overflow-x-auto snap-x snap-proximity pb-2" tabIndex={0} aria-label="Approval cards">{filtered.map(t => <article key={t.id} aria-label={t.text} className="w-72 max-w-full shrink-0 snap-start rounded-xl border bg-background p-3 flex flex-col gap-2 text-sm">
        <div className="flex items-start justify-between gap-2"><h3 className="font-medium break-words min-w-0">{t.text}</h3><span className={`badge shrink-0 ${STATUS_STYLES[t.status] || ''}`}>{t.status}</span></div>
        <p className="text-sm text-muted line-clamp-2 break-words">{t.description}</p>
        <p className="text-xs"><span className="text-muted">Submitted by: </span>{t.submittedBy ? `${t.submittedBy.name}${t.submittedBy.role === 'prof' ? ' (Professor)' : ''}` : t.addedBy === 'prof' ? 'Professor (unavailable)' : 'Student (unavailable)'}</p>
        <div><p className="text-xs text-muted mb-1">Group members</p><div className="flex flex-wrap gap-1">{t.members.length ? t.members.map(m => <span key={m.id} className="rounded-full bg-secondary px-2 py-1 text-xs break-words max-w-full">{m.name}</span>) : <span className="text-xs text-muted">No current members</span>}</div></div>
        <div className="mt-auto space-y-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => onReview(t.id)}>Full review</button>
          {t.status === 'pending' && <>
            <label htmlFor={`${id}-${t.id}`} className="label">Rejection comment (optional)</label>
            <input id={`${id}-${t.id}`} className="input text-xs" value={comments[t.id] || ''} onChange={e => setComments(current => ({ ...current, [t.id]: e.target.value }))} />
            <div className="flex flex-wrap gap-2"><button disabled={saving} className="btn-primary text-sm" onClick={() => decide(t.id, 'verified')}>{busy[t.id] ? 'Saving...' : 'Approve'}</button><button disabled={saving} className="btn-danger text-sm" onClick={() => decide(t.id, 'rejected')}>Reject</button></div>
          </>}
        </div>
      </article>)}</div>}
    <p role="status" className="text-xs text-muted">{result || 'Approvals apply to the selected project slot. Scroll to see more.'}</p>
    <Dialog open={!!batch} onOpenChange={open => { if (!open && !batchBusy) setBatch(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Approve {batch?.length} titles?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted">These are the pending titles matching your current filters in this slot.</p>
        <ul className="max-h-48 overflow-y-auto text-sm space-y-2">{batch?.map(t => <li key={t.id}>{t.text}</li>)}</ul>
        <DialogFooter><button className="btn-secondary" disabled={batchBusy} onClick={() => setBatch(null)}>Cancel</button><button className="btn-primary" disabled={batchBusy} onClick={approveBatch}>{batchBusy ? 'Approving...' : 'Confirm approvals'}</button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
