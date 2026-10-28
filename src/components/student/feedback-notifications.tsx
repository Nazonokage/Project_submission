'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Notification = {
  readAt?: string | null; id: string; body: string; type: string; status: string; createdAt: string;
  professorName: string; titleId: string; titleText: string; slotId: string; classId: string;
};

export function FeedbackNotifications() {
  const revision = useRef(0);
  const marking = useRef(new Set<string>());
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (document.visibilityState === 'hidden' || pending) return;
      pending = true;
      const version = revision.current;
      try {
        const response = await fetch('/api/student/notifications', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Could not load feedback. Please try again.');
        const data = await response.json();
        if (version === revision.current) setItems(data.notifications || []);
        setError('');
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load feedback.');
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(load, 10000);
    document.addEventListener('visibilitychange', load);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [open]);
  async function markRead(id: string) {
    if (marking.current.has(id)) return;
    marking.current.add(id); revision.current++;
    setBusyIds([...marking.current]); setSaveError('');
    try {
      const response = await fetch('/api/student/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feedbackId: id }) });
      if (!response.ok) throw new Error('Could not mark feedback as read. Please try again.');
      setItems(current => current.map(item => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Could not mark feedback as read.'); }
    finally { revision.current++; marking.current.delete(id); setBusyIds([...marking.current]); }
  }
  const unreadCount = items.filter((item) => !item.readAt).length;
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`Feedback notifications, ${unreadCount} unread`}>
      <Bell className="h-4 w-4" /> Feedback {unreadCount > 0 && <span className="rounded-full bg-primary px-1.5 text-primary-foreground">{unreadCount}</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Feedback notifications</DialogTitle><DialogDescription>Professor feedback for your group projects. The badge counts unread feedback. Marking a message as read does not resolve it.</DialogDescription></DialogHeader>
        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {loading ? <p>Loading feedback…</p> : !error && items.length === 0 ? <p className="text-sm text-muted">No feedback yet.</p> : null}
        <div className="space-y-3">
          {items.map((item) => <article key={item.id} className={`rounded-lg border p-3 space-y-2 ${!item.readAt ? 'border-primary/50 bg-primary/5' : ''}`}>
            <div className="flex items-start justify-between gap-2"><p className="font-medium break-words">{item.titleText}</p><span className="text-xs shrink-0 text-muted">{item.readAt ? 'Read' : 'Unread'}</span></div>
            <p className="text-xs text-muted">{item.professorName} · {new Date(item.createdAt).toLocaleString()} · {item.type.replaceAll('_', ' ')} · {item.status}</p>
            <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
            <div className="flex flex-wrap items-center justify-between gap-2"><Link className="text-sm underline" href={`/c/${item.classId}/${item.slotId}?feedback=${item.titleId}#title-${item.titleId}`} onClick={() => setOpen(false)}>Open project</Link>
            {!item.readAt && <Button type="button" variant="outline" size="sm" disabled={busyIds.includes(item.id)} onClick={() => markRead(item.id)}>{busyIds.includes(item.id) ? 'Saving…' : 'Mark as read'}</Button>}</div>
          </article>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
