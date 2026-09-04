'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type FeedbackItem = {
  id: string;
  type: string;
  body: string;
  status: string;
  createdAt: string;
  professorName?: string;
};

const TYPE_LABEL: Record<string, string> = {
  comment: 'Comment',
  request_changes: 'Request changes',
  approval: 'Approval',
};

export function FeedbackList({
  items,
  canResolve,
  onChanged,
}: {
  items: FeedbackItem[];
  canResolve?: boolean;
  onChanged?: () => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">No feedback yet.</p>;
  }

  async function setStatus(id: string, status: 'open' | 'resolved') {
    const res = await fetch(`/api/dashboard/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Could not update feedback');
      return;
    }
    onChanged?.();
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-line p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {TYPE_LABEL[item.type] || item.type}
              {item.status === 'resolved' ? ' · resolved' : ''}
            </p>
            {canResolve && (
              <button
                type="button"
                className="text-xs text-accent hover:underline"
                onClick={() => setStatus(item.id, item.status === 'resolved' ? 'open' : 'resolved')}
              >
                {item.status === 'resolved' ? 'Reopen' : 'Resolve'}
              </button>
            )}
          </div>
          <p className="text-sm">{item.body}</p>
          <p className="text-xs text-muted">
            {item.professorName ? `${item.professorName} · ` : ''}
            {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ProfessorFeedbackForm({
  titleId,
  reportId,
  onSaved,
}: {
  titleId: string;
  reportId?: string | null;
  onSaved: () => void;
}) {
  const [type, setType] = useState<'comment' | 'request_changes' | 'approval'>('comment');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleId, reportId: reportId || undefined, type, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save feedback');
      toast.success('Feedback sent to the group');
      setBody('');
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save feedback');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(['comment', 'request_changes', 'approval'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn-secondary text-xs py-1 ${type === value ? 'bg-accent text-white border-accent' : ''}`}
            onClick={() => setType(value)}
          >
            {TYPE_LABEL[value]}
          </button>
        ))}
      </div>
      <Textarea
        required
        className="min-h-20"
        placeholder="Visible to the student group"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? 'Sending…' : 'Leave feedback'}
      </Button>
    </form>
  );
}

export type ReportRow = {
  id: string;
  version: string | null;
  changelog: string | null;
  progressSummary: string | null;
  repoUrl: string | null;
  deploymentUrl: string | null;
  extraLinks: string[] | null;
  isEditable: boolean;
  createdAt: string;
};

export function TitleReviewDialog({
  titleId,
  titleText,
  open,
  onOpenChange,
  asProfessor,
}: {
  titleId: string;
  titleText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asProfessor?: boolean;
}) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [notes, setNotes] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const reportsUrl = asProfessor
      ? `/api/dashboard/titles/${titleId}/reports`
      : `/api/student/titles/${titleId}/reports`;
    const feedbackUrl = asProfessor
      ? `/api/dashboard/feedback?titleId=${titleId}`
      : `/api/student/titles/${titleId}/feedback`;
    const [reportsRes, feedbackRes] = await Promise.all([fetch(reportsUrl), fetch(feedbackUrl)]);
    if (reportsRes.ok) setReports((await reportsRes.json()).reports || []);
    if (feedbackRes.ok) setNotes((await feedbackRes.json()).feedback || []);
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titleId, asProfessor]);

  async function toggleLock(report: ReportRow) {
    const res = await fetch(`/api/dashboard/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEditable: !report.isEditable }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Could not update report');
      return;
    }
    toast.success(report.isEditable ? 'Report locked' : 'Report unlocked');
    load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>Version reports and feedback for this title.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="space-y-4">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Reports</h3>
              {reports.length === 0 ? (
                <p className="text-sm text-muted">No version reports yet.</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-line p-3 space-y-1">
                    <p className="text-sm font-medium">
                      {r.version ? `v${r.version}` : 'Report'}
                      {!r.isEditable ? ' · locked' : ''}
                    </p>
                    {r.progressSummary && <p className="text-sm">{r.progressSummary}</p>}
                    {r.changelog && <p className="text-xs text-muted">{r.changelog}</p>}
                    {asProfessor && (
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        onClick={() => toggleLock(r)}
                      >
                        {r.isEditable ? 'Lock report' : 'Unlock report'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Feedback</h3>
              <FeedbackList items={notes} canResolve={asProfessor} onChanged={load} />
              {asProfessor && <ProfessorFeedbackForm titleId={titleId} onSaved={load} />}
            </section>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportFormDialog({
  titleId,
  open,
  onOpenChange,
  onSaved,
  initial,
}: {
  titleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initial?: { repoUrl?: string | null; deploymentUrl?: string | null };
}) {
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [progressSummary, setProgressSummary] = useState('');
  const [repoUrl, setRepoUrl] = useState(initial?.repoUrl || '');
  const [deploymentUrl, setDeploymentUrl] = useState(initial?.deploymentUrl || '');
  const [extraLinks, setExtraLinks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRepoUrl(initial?.repoUrl || '');
    setDeploymentUrl(initial?.deploymentUrl || '');
  }, [open, initial?.repoUrl, initial?.deploymentUrl]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/student/titles/${titleId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version,
          changelog,
          progressSummary,
          repoUrl,
          deploymentUrl,
          extraLinks: extraLinks
            .split(/\n|,/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit report');
      toast.success('Version report submitted');
      setVersion('');
      setChangelog('');
      setProgressSummary('');
      setExtraLinks('');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit report');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a version report</DialogTitle>
          <DialogDescription>Share progress after your title is verified.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Version</Label>
            <input className="input" required placeholder="1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div>
            <Label>Progress summary</Label>
            <Textarea required className="min-h-20" value={progressSummary} onChange={(e) => setProgressSummary(e.target.value)} />
          </div>
          <div>
            <Label>Changelog</Label>
            <Textarea required className="min-h-20" value={changelog} onChange={(e) => setChangelog(e.target.value)} />
          </div>
          <div>
            <Label>Repo URL</Label>
            <input className="input" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
          </div>
          <div>
            <Label>Deployment URL</Label>
            <input className="input" value={deploymentUrl} onChange={(e) => setDeploymentUrl(e.target.value)} />
          </div>
          <div>
            <Label>Extra links (optional, one per line)</Label>
            <Textarea className="min-h-16" value={extraLinks} onChange={(e) => setExtraLinks(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
