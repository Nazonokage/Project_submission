'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, FileText, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from './status-badge';
import { TechStackInput } from './tech-stack-input';
import { ProgressSelect } from './progress-select';
import { ProgressReportModal } from './progress-report-modal';
import type { ProjectTitle } from './types';
import type { ProgressStatus } from '@/lib/progress';

export type TitleReportItem = {
  id: string;
  version: string | null;
  changelog: string | null;
  progressSummary: string | null;
  repoUrl: string | null;
  deploymentUrl: string | null;
  extraLinks: string[] | null;
  isEditable: boolean;
  createdAt: string;
  updatedAt: string;
};

type DocField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'url' | 'date';
  required: boolean;
};

export function TitleCard({
  title,
  slotId,
  requireDeploymentUrl,
  canEdit,
  onUpdated,
}: {
  title: ProjectTitle;
  slotId?: string;
  requireDeploymentUrl?: boolean;
  canEdit?: boolean;
  onUpdated?: () => void;
}) {
  const effectiveSlotId = slotId || title.slotId;
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressBusy, setProgressBusy] = useState(false);
  const [text, setText] = useState(title.text);
  const [description, setDescription] = useState(title.description);
  const [techStack, setTechStack] = useState(title.techStack || []);
  const [targetUsers, setTargetUsers] = useState(title.targetUsers || '');
  const [repoUrl, setRepoUrl] = useState(title.repoUrl || '');
  const [deploymentUrl, setDeploymentUrl] = useState(title.deploymentUrl || '');

  // Persistent Project Documentation state
  const [docTemplates, setDocTemplates] = useState<DocField[]>([]);
  const [docValues, setDocValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (title.documentation && typeof title.documentation === 'object') {
      for (const [k, v] of Object.entries(title.documentation)) {
        initial[k] = v !== null && v !== undefined ? String(v) : '';
      }
    }
    return initial;
  });
  const [savingDoc, setSavingDoc] = useState(false);

  useEffect(() => {
    if (title.documentation && typeof title.documentation === 'object') {
      const updated: Record<string, string> = {};
      for (const [k, v] of Object.entries(title.documentation)) {
        updated[k] = v !== null && v !== undefined ? String(v) : '';
      }
      setDocValues(updated);
    }
  }, [title.documentation]);

  // Reports state
  const [reports, setReports] = useState<TitleReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showAllReports, setShowAllReports] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  const loadDocTemplates = useCallback(async () => {
    if (!effectiveSlotId) return;
    try {
      const res = await fetch(`/api/student/slots/${effectiveSlotId}/doc-fields`);
      if (res.ok) {
        const data = await res.json();
        setDocTemplates(data.fields || []);
      }
    } catch {
      // ignore
    }
  }, [effectiveSlotId]);

  useEffect(() => {
    loadDocTemplates();
  }, [loadDocTemplates]);

  const missingRequiredCount = useMemo(() => {
    return docTemplates.filter((t) => {
      if (!t.required) return false;
      const val = docValues[t.fieldKey];
      return !val || !val.trim();
    }).length;
  }, [docTemplates, docValues]);

  const loadReports = useCallback(async () => {
    if (title.status !== 'verified') return;
    setReportsLoading(true);
    try {
      const res = await fetch(`/api/student/titles/${title.id}/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      // ignore
    } finally {
      setReportsLoading(false);
    }
  }, [title.id, title.status]);

  useEffect(() => {
    if (title.status === 'verified') {
      loadReports();
    }
  }, [title.status, loadReports]);

  async function saveProgress(next: ProgressStatus) {
    setProgressBusy(true);
    try {
      const res = await fetch(`/api/student/titles/${title.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressStatus: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update progress');
      toast.success('Progress updated');
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update progress');
    } finally {
      setProgressBusy(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/student/titles/${title.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, description, techStack, targetUsers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update title');
      toast.success('Title updated');
      setEditOpen(false);
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update title');
    } finally {
      setSaving(false);
    }
  }

  async function saveRepo() {
    setSaving(true);
    try {
      const res = await fetch(`/api/student/titles/${title.id}/repo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, deploymentUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save repo URL');
      toast.success('Repo URL saved');
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save repo URL');
    } finally {
      setSaving(false);
    }
  }

  async function saveProjectDocumentation() {
    setSavingDoc(true);
    try {
      const res = await fetch(`/api/student/titles/${title.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentation: docValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save documentation');
      toast.success('Project documentation saved');
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save documentation');
    } finally {
      setSavingDoc(false);
    }
  }

  const editable = canEdit;
  const displayedReports = showAllReports ? reports : reports.slice(0, 2);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{title.text}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ProgressSelect
            value={title.progressStatus}
            disabled={progressBusy}
            onChange={saveProgress}
          />
          <StatusBadge kind="title" status={title.status} />
          {editable && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted">{title.description}</p>
        {title.techStack && title.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {title.techStack.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {title.targetUsers && (
          <p className="text-sm text-muted">Target users: {title.targetUsers}</p>
        )}
        {title.status === 'rejected' && title.rejectionReason && (
          <Alert variant="destructive">
            <AlertDescription>Rejected: {title.rejectionReason}</AlertDescription>
          </Alert>
        )}
        {title.status === 'verified' && (
          <div className="pt-3 border-t space-y-4">
            {/* Repo and Deployment links */}
            <div className="space-y-2">
              {title.repoUrl && (
                <p className="text-sm flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <a href={title.repoUrl} className="text-primary hover:underline truncate" target="_blank" rel="noreferrer">
                    {title.repoUrl}
                  </a>
                </p>
              )}
              {title.deploymentUrl && (
                <p className="text-sm flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <a
                    href={title.deploymentUrl}
                    className="text-primary hover:underline truncate"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {title.deploymentUrl}
                  </a>
                </p>
              )}
              <div className="space-y-2">
                <Label>Repository URL</Label>
                <Input
                  placeholder="https://github.com/..."
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
                <Label>Deployment URL{requireDeploymentUrl ? ' (required)' : ''}</Label>
                <Input
                  placeholder="https://..."
                  value={deploymentUrl}
                  onChange={(e) => setDeploymentUrl(e.target.value)}
                />
                <Button type="button" size="sm" onClick={saveRepo} disabled={saving}>
                  {title.repoUrl ? 'Update URLs' : 'Save repo URL'}
                </Button>
              </div>
            </div>

            {/* Persistent Project Documentation Section */}
            {docTemplates.length > 0 && (
              <div className="pt-2 border-t space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted" />
                    <span className="text-sm font-medium">Project Documentation</span>
                    {missingRequiredCount === 0 ? (
                      <Badge variant="secondary" className="text-xs text-ok bg-sage/20 border-sage/40">
                        Documentation: complete
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs text-warn bg-amber-500/10 border-amber-500/30">
                        {missingRequiredCount} field{missingRequiredCount === 1 ? '' : 's'} missing
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveProjectDocumentation}
                    disabled={savingDoc}
                  >
                    {savingDoc && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Save Documentation
                  </Button>
                </div>

                <div className="space-y-3 bg-secondary/15 rounded-lg p-3 border border-border/60">
                  {docTemplates.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`doc-field-${field.fieldKey}`} className="text-xs font-medium">
                          {field.label}{' '}
                          {field.required ? (
                            <span className="text-warn font-normal">(required)</span>
                          ) : (
                            <span className="text-muted font-normal">(optional)</span>
                          )}
                        </Label>
                        {!docValues[field.fieldKey]?.trim() && field.required && (
                          <span className="text-[11px] text-warn">Missing</span>
                        )}
                      </div>
                      {field.fieldType === 'textarea' ? (
                        <Textarea
                          id={`doc-field-${field.fieldKey}`}
                          className="min-h-16 text-sm"
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          value={docValues[field.fieldKey] || ''}
                          onChange={(e) =>
                            setDocValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))
                          }
                        />
                      ) : (
                        <Input
                          id={`doc-field-${field.fieldKey}`}
                          type={field.fieldType === 'date' ? 'date' : field.fieldType === 'url' ? 'url' : 'text'}
                          placeholder={field.fieldType === 'url' ? 'https://...' : `Enter ${field.label.toLowerCase()}...`}
                          value={docValues[field.fieldKey] || ''}
                          onChange={(e) =>
                            setDocValues((prev) => ({ ...prev, [field.fieldKey]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Reports Subsection */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted" />
                  <span className="text-sm font-medium">Progress Reports</span>
                  {reports.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {reports.length}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReportDialogOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Submit Report
                </Button>
              </div>

              {reportsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : reports.length === 0 ? (
                <p className="text-xs text-muted py-1">
                  No version reports submitted yet. Submit one to document milestone progress.
                </p>
              ) : (
                <div className="space-y-2">
                  {displayedReports.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-secondary/20 p-3 text-sm space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs font-mono">
                            {r.version || 'Update'}
                          </Badge>
                          <span className="font-medium text-xs">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {!r.isEditable && (
                          <span className="text-[11px] text-muted">Locked by prof</span>
                        )}
                      </div>
                      {r.progressSummary && (
                        <p className="text-xs font-medium text-ink/90 mt-1">{r.progressSummary}</p>
                      )}
                      {r.changelog && (
                        <p className="text-xs text-muted line-clamp-2 whitespace-pre-wrap">{r.changelog}</p>
                      )}
                      {(r.repoUrl || r.deploymentUrl) && (
                        <div className="flex items-center gap-3 pt-1 text-xs">
                          {r.repoUrl && (
                            <a
                              href={r.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" /> Repo
                            </a>
                          )}
                          {r.deploymentUrl && (
                            <a
                              href={r.deploymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" /> Live
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {reports.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted h-8"
                      onClick={() => setShowAllReports((prev) => !prev)}
                    >
                      {showAllReports ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5 mr-1" /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" /> Show all {reports.length} reports
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Title Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit title</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tech stack</Label>
              <TechStackInput value={techStack} onChange={setTechStack} />
            </div>
            <div className="space-y-1.5">
              <Label>Target users</Label>
              <Input value={targetUsers} onChange={(e) => setTargetUsers(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProgressReportModal
        open={reportDialogOpen}
        titleId={title.id}
        initialMode="milestone"
        onClose={() => setReportDialogOpen(false)}
        onSuccess={async () => { await loadReports(); onUpdated?.(); }}
      />
    </Card>
  );
}
