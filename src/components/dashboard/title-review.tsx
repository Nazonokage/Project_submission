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

export type TaskItemRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  assigneeName?: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export type UpdateItem = {
  id: string;
  kind: string;
  headline: string | null;
  body: string;
  changelog?: string | null;
  commitSha?: string | null;
  commitUrl?: string | null;
  studentName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

type DocFieldTemplate = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
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
  const [tasks, setTasks] = useState<TaskItemRow[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [notes, setNotes] = useState<FeedbackItem[]>([]);
  const [titleDoc, setTitleDoc] = useState<Record<string, unknown> | null>(null);
  const [docFields, setDocFields] = useState<DocFieldTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const titleUrl = asProfessor
      ? `/api/dashboard/titles/${titleId}`
      : `/api/student/titles/${titleId}`;
    const reportsUrl = asProfessor
      ? `/api/dashboard/titles/${titleId}/reports`
      : `/api/student/titles/${titleId}/reports`;
    const tasksUrl = asProfessor
      ? `/api/prof/tasks?titleId=${titleId}`
      : `/api/student/tasks?titleId=${titleId}`;
    const updatesUrl = asProfessor
      ? `/api/prof/updates?titleId=${titleId}`
      : `/api/student/updates?titleId=${titleId}`;
    const feedbackUrl = asProfessor
      ? `/api/dashboard/feedback?titleId=${titleId}`
      : `/api/student/titles/${titleId}/feedback`;
    const [titleRes, reportsRes, tasksRes, updatesRes, feedbackRes] = await Promise.all([
      fetch(titleUrl),
      fetch(reportsUrl),
      fetch(tasksUrl),
      fetch(updatesUrl),
      fetch(feedbackUrl),
    ]);
    if (titleRes.ok) {
      const data = await titleRes.json();
      setTitleDoc(data.title?.documentation || null);
      setDocFields(data.docFields || []);
    }
    if (reportsRes.ok) setReports((await reportsRes.json()).reports || []);
    if (tasksRes.ok) setTasks((await tasksRes.json()).tasks || []);
    if (updatesRes.ok) setUpdates((await updatesRes.json()).updates || []);
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
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
          <DialogDescription>Project documentation, version reports, tasks, updates, and feedback for this title.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="space-y-5">
            {/* Project Documentation Section */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Project Documentation
              </h3>
              <div className="rounded-lg border border-line p-3 space-y-3 bg-secondary/15 text-sm">
                {docFields.length > 0 ? (
                  docFields.map((field) => {
                    const rawVal = titleDoc ? titleDoc[field.fieldKey] : null;
                    const hasVal = rawVal !== null && rawVal !== undefined && String(rawVal).trim().length > 0;
                    return (
                      <div key={field.id} className="space-y-1">
                        <p className="text-xs font-medium text-ink">
                          {field.label}{' '}
                          {field.required ? (
                            <span className="text-warn text-[11px] font-normal">(required)</span>
                          ) : (
                            <span className="text-muted text-[11px] font-normal">(optional)</span>
                          )}
                        </p>
                        {hasVal ? (
                          <p className="text-xs text-muted whitespace-pre-wrap">{String(rawVal)}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/70 italic">Not yet filled</p>
                        )}
                      </div>
                    );
                  })
                ) : titleDoc && Object.keys(titleDoc).length > 0 ? (
                  Object.entries(titleDoc).map(([k, v]) => {
                    const hasVal = v !== null && v !== undefined && String(v).trim().length > 0;
                    return (
                      <div key={k} className="space-y-1">
                        <p className="text-xs font-medium text-ink capitalize">{k.replace(/_/g, ' ')}</p>
                        {hasVal ? (
                          <p className="text-xs text-muted whitespace-pre-wrap">{String(v)}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/70 italic">Not yet filled</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted italic">No documentation recorded yet.</p>
                )}
              </div>
            </section>

            {/* Reports Section */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Reports & Deliverables
                <span className="text-xs text-muted font-normal">({reports.length})</span>
              </h3>
              {reports.length === 0 ? (
                <p className="text-sm text-muted">No version reports submitted yet.</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-line p-3 space-y-2 bg-secondary/15">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {r.version ? `v${r.version}` : 'Report'}
                        {!r.isEditable ? ' · locked' : ''}
                      </p>
                      <span className="text-xs text-muted">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {r.progressSummary && <p className="text-sm">{r.progressSummary}</p>}
                    {r.changelog && <p className="text-xs text-muted whitespace-pre-wrap">{r.changelog}</p>}
                    {(r.repoUrl || r.deploymentUrl) && (
                      <div className="flex items-center gap-3 pt-1 text-xs">
                        {r.repoUrl && (
                          <a
                            href={r.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            Repo
                          </a>
                        )}
                        {r.deploymentUrl && (
                          <a
                            href={r.deploymentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            Live
                          </a>
                        )}
                      </div>
                    )}
                    {asProfessor && (
                      <div className="pt-1">
                        <button
                          type="button"
                          className="text-xs text-accent hover:underline"
                          onClick={() => toggleLock(r)}
                        >
                          {r.isEditable ? 'Lock report' : 'Unlock report'}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            {/* Tasks Audit Section */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Tasks ({tasks.length})
              </h3>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted">No tasks tracked yet.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg border p-2.5 text-xs space-y-1 ${
                        t.deletedAt ? 'border-destructive/30 bg-destructive/5 opacity-70' : 'border-line bg-secondary/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{t.name}</span>
                          <span className="badge text-[10px] uppercase">{t.status.replace('_', ' ')}</span>
                          {t.deletedAt && (
                            <span className="badge text-[10px] bg-destructive/20 text-destructive">deleted</span>
                          )}
                        </div>
                        {t.assigneeName && <span className="text-muted">Assigned: {t.assigneeName}</span>}
                      </div>
                      {t.description && <p className="text-muted line-clamp-2">{t.description}</p>}
                      {t.dueDate && (
                        <p className="text-[11px] text-muted">Due: {new Date(t.dueDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Project Updates Section */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Project Updates ({updates.length})
              </h3>
              {updates.length === 0 ? (
                <p className="text-sm text-muted">No updates logged yet.</p>
              ) : (
                updates.map((u) => (
                  <div
                    key={u.id}
                    className={`rounded-lg border p-3 space-y-1 ${
                      u.deletedAt ? 'border-destructive/30 bg-destructive/5 opacity-75' : 'border-line'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="badge text-xs uppercase">{u.kind}</span>
                        {u.headline && <span className="font-medium text-xs">{u.headline}</span>}
                        {u.commitSha && (
                          u.commitUrl ? (
                            <a
                              href={u.commitUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-xs text-primary hover:underline bg-primary/10 px-1 rounded"
                            >
                              {u.commitSha.slice(0, 7)}
                            </a>
                          ) : (
                            <span className="font-mono text-xs bg-secondary px-1 rounded text-muted-foreground">
                              {u.commitSha.slice(0, 7)}
                            </span>
                          )
                        )}
                        {u.updatedAt && <span className="text-[11px] text-muted">(edited)</span>}
                        {u.deletedAt && (
                          <span className="badge text-[10px] bg-destructive/20 text-destructive">
                            deleted
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted">
                        {u.studentName ? `${u.studentName} · ` : ''}
                        {new Date(u.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted whitespace-pre-wrap">{u.body}</p>
                    {u.changelog && (
                      <div className="pt-1">
                        <p className="text-[11px] font-medium text-ink/80">Changelog:</p>
                        <p className="text-xs text-muted whitespace-pre-wrap bg-secondary/30 p-2 rounded mt-0.5">
                          {u.changelog}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            {/* Feedback Section */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Feedback</h3>
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
