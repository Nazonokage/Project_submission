'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function ClassLifecycle({ classId, name, archived, onChanged }: { classId: string; name: string; archived: boolean; onChanged: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [busy, setBusy] = useState(false);
  async function change(remove = false) {
    setBusy(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: remove ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(remove ? { confirmName } : { archived: !archived }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update class');
      toast.success(remove ? 'Class deleted' : archived ? 'Class restored' : 'Class archived');
      if (remove) router.push('/dashboard'); else onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update class'); }
    finally { setBusy(false); }
  }
  return <section className="card space-y-3">
    <h2 className="font-semibold">Class settings</h2>
    <p className="text-sm text-muted">{archived ? 'This class is archived.' : 'Archive this class to hide it from your default class list.'} Existing student access and work are preserved.</p>
    <div className="flex gap-2"><button disabled={busy} className="btn-secondary" onClick={() => change()}>{archived ? 'Restore class' : 'Archive class'}</button><button className="btn-danger" onClick={() => { setConfirmName(''); setOpen(true); }}>Delete class</button></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Delete {name}?</DialogTitle><DialogDescription>This permanently deletes the class, roster, groups, slots, titles, tasks, and reports. Archive instead to keep the work.</DialogDescription></DialogHeader>
      <label className="label" htmlFor="delete-class-name">Type {name} to confirm</label><input id="delete-class-name" className="input" value={confirmName} onChange={e => setConfirmName(e.target.value)} autoComplete="off" />
      <button disabled={busy || confirmName.trim() !== name.trim()} className="btn-danger" onClick={() => change(true)}>{busy ? 'Deleting...' : 'Permanently delete class'}</button>
    </DialogContent></Dialog>
  </section>;
}
