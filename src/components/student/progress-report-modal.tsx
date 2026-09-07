'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type Mode = 'quick' | 'milestone';

export function ProgressReportModal({
  open,
  titleId,
  initialMode = 'quick',
  onClose,
  onSuccess,
}: {
  open: boolean;
  titleId: string;
  initialMode?: Mode;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [kind, setKind] = useState<'progress' | 'note' | 'commit'>('progress');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [changelog, setChangelog] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [commitUrl, setCommitUrl] = useState('');
  const [version, setVersion] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  function reset() {
    setKind('progress'); setHeadline(''); setBody(''); setChangelog('');
    setCommitSha(''); setCommitUrl(''); setVersion(''); setRepoUrl(''); setDeploymentUrl('');
  }

  async function save() {
    if (!titleId) return;
    if (mode === 'quick' && (!headline.trim() || !body.trim())) {
      toast.error('Headline and details are required');
      return;
    }
    if (mode === 'milestone' && (!version.trim() || !body.trim() || !changelog.trim())) {
      toast.error('Version, progress summary, and changelog are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        mode === 'quick' ? '/api/student/updates' : `/api/student/titles/${titleId}/reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'quick'
            ? { titleId, kind, headline: headline.trim(), body: body.trim(), changelog: changelog.trim() || undefined, commitSha: commitSha.trim() || undefined, commitUrl: commitUrl.trim() || undefined }
            : { version: version.trim(), progressSummary: body.trim(), changelog: changelog.trim(), repoUrl: repoUrl.trim() || undefined, deploymentUrl: deploymentUrl.trim() || undefined }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save progress');
      toast.success(mode === 'quick' ? 'Update posted' : 'Version report submitted');
      reset();
      await onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save progress');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Progress / Report</DialogTitle>
          <DialogDescription>Post a lightweight update or submit a formal version report.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/40 p-1">
            <Button type="button" variant={mode === 'quick' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('quick')}>Quick update</Button>
            <Button type="button" variant={mode === 'milestone' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('milestone')}>Milestone / version</Button>
          </div>
          {mode === 'quick' ? <>
            <div className="space-y-1.5"><Label>Type</Label><select className="input py-1 text-sm w-full" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="progress">Progress</option><option value="note">Note</option><option value="commit">Commit</option></select></div>
            <div className="space-y-1.5"><Label>Headline</Label><Input placeholder="e.g. Built the login page" value={headline} onChange={(e) => setHeadline(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Details</Label><Textarea className="min-h-20" placeholder="What was done? Any blockers?" value={body} onChange={(e) => setBody(e.target.value)} /></div>
            {kind === 'commit' && <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label>Commit SHA (optional)</Label><Input value={commitSha} onChange={(e) => setCommitSha(e.target.value)} /></div><div className="space-y-1.5"><Label>Commit URL (optional)</Label><Input placeholder="https://..." value={commitUrl} onChange={(e) => setCommitUrl(e.target.value)} /></div></div>}
          </> : <>
            <div className="space-y-1.5"><Label>Version / milestone tag</Label><Input placeholder="e.g. 1.2" value={version} onChange={(e) => setVersion(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Progress summary</Label><Textarea className="min-h-20" value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label>Repository URL (optional)</Label><Input placeholder="https://..." value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} /></div><div className="space-y-1.5"><Label>Deployment URL (optional)</Label><Input placeholder="https://..." value={deploymentUrl} onChange={(e) => setDeploymentUrl(e.target.value)} /></div></div>
          </>}
          <div className="space-y-1.5"><Label>Changelog{mode === 'milestone' ? '' : ' (optional)'}</Label><Textarea className="min-h-16" placeholder="List what changed or key highlights..." value={changelog} onChange={(e) => setChangelog(e.target.value)} /></div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" disabled={saving} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{mode === 'quick' ? 'Post update' : 'Submit report'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
