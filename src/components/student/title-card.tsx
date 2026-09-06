'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Loader2, Pencil, Plus } from 'lucide-react';
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

export function TitleCard({
  title,
  requireDeploymentUrl,
  canEdit,
  onUpdated,
}: {
  title: ProjectTitle;
  requireDeploymentUrl?: boolean;
  canEdit?: boolean;
  onUpdated?: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressBusy, setProgressBusy] = useState(false);
  const [text, setText] = useState(title.text);
  const [description, setDescription] = useState(title.description);
  const [techStack, setTechStack] = useState(title.techStack || []);
  const [targetUsers, setTargetUsers] = useState(title.targetUsers || '');
  const [repoUrl, setRepoUrl] = useState(title.repoUrl || '');
  const [deploymentUrl, setDeploymentUrl] = useState(title.deploymentUrl || '');

  // Reports state
  const [reports, setReports] = useState<TitleReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showAllReports, setShowAllReports] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportVersion, setReportVersion] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [reportChangelog, setReportChangelog] = useState('');
  const [reportRepoUrl, setReportRepoUrl] = useState('');
  const [reportDeployUrl, setReportDeployUrl] = useState('');
  const [reportExtraLinks, setReportExtraLinks] = useState('');

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

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportVersion.trim() || !reportSummary.trim() || !reportChangelog.trim()) {
      toast.error('Version, summary, and changelog are required');
      return;
    }

    setSubmittingReport(true);
    try {
      const links = reportExtraLinks
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const res = await fetch(`/api/student/titles/${title.id}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: reportVersion.trim(),
          progressSummary: reportSummary.trim(),
          changelog: reportChangelog.trim(),
          repoUrl: reportRepoUrl.trim() || undefined,
          deploymentUrl: reportDeployUrl.trim() || undefined,
          extraLinks: links.length > 0 ? links : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit report');

      toast.success('Progress report submitted');
      setReportVersion('');
      setReportSummary('');
      setReportChangelog('');
      setReportRepoUrl('');
      setReportDeployUrl('');
      setReportExtraLinks('');
      setReportDialogOpen(false);
      await loadReports();
      onUpdated?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit report');
    } finally {
      setSubmittingReport(false);
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
                    setReportRepoUrl(title.repoUrl || '');
                    setReportDeployUrl(title.deploymentUrl || '');
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

      {/* Submit Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Progress Report</DialogTitle>
            <DialogDescription>
              Record a milestone version report for your verified title.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReport} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="report-version">Version / Milestone Tag</Label>
              <Input
                id="report-version"
                required
                placeholder="e.g. v1.0, Sprint 2, Beta"
                value={reportVersion}
                onChange={(e) => setReportVersion(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-summary">Progress Summary</Label>
              <Input
                id="report-summary"
                required
                placeholder="e.g. Completed user authentication and database migrations"
                value={reportSummary}
                onChange={(e) => setReportSummary(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-changelog">Changelog / Deliverables</Label>
              <Textarea
                id="report-changelog"
                required
                className="min-h-20"
                placeholder="List key features delivered, tests run, or fixes made..."
                value={reportChangelog}
                onChange={(e) => setReportChangelog(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="report-repo" className="text-xs">Repository URL (optional)</Label>
                <Input
                  id="report-repo"
                  placeholder="https://github.com/..."
                  value={reportRepoUrl}
                  onChange={(e) => setReportRepoUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="report-deploy" className="text-xs">Deployment URL (optional)</Label>
                <Input
                  id="report-deploy"
                  placeholder="https://..."
                  value={reportDeployUrl}
                  onChange={(e) => setReportDeployUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-links" className="text-xs">Extra Links (optional, one per line)</Label>
              <Textarea
                id="report-links"
                className="min-h-14 text-xs font-mono"
                placeholder="https://figma.com/file/...&#10;https://docs.google.com/..."
                value={reportExtraLinks}
                onChange={(e) => setReportExtraLinks(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setReportDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReport}>
                {submittingReport && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Report
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
