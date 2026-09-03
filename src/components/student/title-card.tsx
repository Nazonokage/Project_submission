'use client';

import { useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from './status-badge';
import { TechStackInput } from './tech-stack-input';
import { ProgressSelect } from './progress-select';
import type { ProjectTitle } from './types';
import type { ProgressStatus } from '@/lib/progress';

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

  const editable = canEdit && (title.status === 'pending' || title.status === 'rejected');

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
          <div className="pt-2 border-t space-y-2">
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
        )}
      </CardContent>

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
    </Card>
  );
}
