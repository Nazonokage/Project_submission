'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TechStackInput } from '@/components/student/tech-stack-input';
import { PROGRESS_LABELS, PROGRESS_STATUSES, type ProgressStatus } from '@/lib/progress';

export type ProfTitle = {
  id: string;
  text: string;
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  status: 'pending' | 'verified' | 'rejected';
  progressStatus?: string | null;
  repoUrl: string | null;
  deploymentUrl?: string | null;
  rejectionReason?: string | null;
};

export function TitleEditor({
  title,
  open,
  onOpenChange,
  onSaved,
}: {
  title: ProfTitle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState(title.text);
  const [description, setDescription] = useState(title.description);
  const [techStack, setTechStack] = useState(title.techStack || []);
  const [targetUsers, setTargetUsers] = useState(title.targetUsers || '');
  const [status, setStatus] = useState(title.status);
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>(
    (PROGRESS_STATUSES as readonly string[]).includes(title.progressStatus || '')
      ? (title.progressStatus as ProgressStatus)
      : 'planning'
  );
  const [repoUrl, setRepoUrl] = useState(title.repoUrl || '');
  const [deploymentUrl, setDeploymentUrl] = useState(title.deploymentUrl || '');
  const [rejectionReason, setRejectionReason] = useState(title.rejectionReason || '');

  useEffect(() => {
    if (!open) return;
    setText(title.text);
    setDescription(title.description);
    setTechStack(title.techStack || []);
    setTargetUsers(title.targetUsers || '');
    setStatus(title.status);
    setProgressStatus(
      (PROGRESS_STATUSES as readonly string[]).includes(title.progressStatus || '')
        ? (title.progressStatus as ProgressStatus)
        : 'planning'
    );
    setRepoUrl(title.repoUrl || '');
    setDeploymentUrl(title.deploymentUrl || '');
    setRejectionReason(title.rejectionReason || '');
  }, [open, title]);

  async function save() {
    if (!text.trim() || !description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/titles/${title.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          description,
          techStack,
          targetUsers,
          status,
          progressStatus,
          repoUrl,
          deploymentUrl,
          rejectionReason: status === 'rejected' ? rejectionReason : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update title');
      toast.success('Title updated');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update title');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          </div>
          <div className="space-y-1.5">
            <Label>Tech stack</Label>
            <TechStackInput value={techStack} onChange={setTechStack} />
          </div>
          <div className="space-y-1.5">
            <Label>Target users</Label>
            <Input value={targetUsers} onChange={(e) => setTargetUsers(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ProfTitle['status'])}>
                <option value="pending">pending</option>
                <option value="verified">verified</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Progress</Label>
              <select
                className="input"
                value={progressStatus}
                onChange={(e) => setProgressStatus(e.target.value as ProgressStatus)}
              >
                {PROGRESS_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROGRESS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {status === 'rejected' && (
            <div className="space-y-1.5">
              <Label>Rejection reason</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Shown to the group"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Repository URL</Label>
            <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/..." />
          </div>
          <div className="space-y-1.5">
            <Label>Deployment URL</Label>
            <Input value={deploymentUrl} onChange={(e) => setDeploymentUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
