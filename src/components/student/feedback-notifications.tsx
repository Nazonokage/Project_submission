'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Notification = {
  id: string; body: string; type: string; status: string; createdAt: string;
  professorName: string; titleId: string; titleText: string; slotId: string; classId: string;
};

export function FeedbackNotifications() {
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
      try {
        const response = await fetch('/api/student/notifications', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Could not load feedback. Please try again.');
        const data = await response.json();
        setItems(data.notifications || []);
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
  const openCount = items.filter((item) => item.status === 'open').length;
  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`Feedback notifications, ${openCount} open`}>
      <Bell className="h-4 w-4" /> Feedback {openCount > 0 && <span className="rounded-full bg-primary px-1.5 text-primary-foreground">{openCount}</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Feedback notifications</DialogTitle><DialogDescription>Professor feedback for your group projects. The badge counts open feedback, including items you have already viewed.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {loading ? <p>Loading feedback…</p> : !error && items.length === 0 ? <p className="text-sm text-muted">No feedback yet.</p> : null}
        <div className="space-y-3">
          {items.map((item) => <article key={item.id} className="rounded-lg border p-3 space-y-2">
            <p className="font-medium break-words">{item.titleText}</p>
            <p className="text-xs text-muted">{item.professorName} · {new Date(item.createdAt).toLocaleString()} · {item.type.replaceAll('_', ' ')} · {item.status}</p>
            <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
            <Link className="text-sm underline" href={`/c/${item.classId}/${item.slotId}?feedback=${item.titleId}#title-${item.titleId}`} onClick={() => setOpen(false)}>Open project</Link>
          </article>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
