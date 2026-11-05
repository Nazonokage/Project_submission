'use client';
import { useBoardRequest } from '@/lib/board-query';
import { toast } from 'sonner';

import { useState } from 'react';
import { Calendar, Clock, GripVertical, User } from 'lucide-react';
import { useKanbanDnd } from '@/components/student/kanban-dnd';
import { Button } from '@/components/ui/button';
import type { Member, ProgressStatus, ProjectTitle, TaskItem } from '@/components/student/types';
import { PROGRESS_LABELS, PROGRESS_STATUSES } from '@/lib/progress';
import { safeExternalUrl } from '@/lib/safe-url';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function TaskCard({
  task,
  members,
  project,
  role = 'student',
}: {
  task: TaskItem;
  members: Member[];
  project: Pick<ProjectTitle, 'text' | 'repoUrl' | 'deploymentUrl'>;
  role?: 'student' | 'prof';
}) {
  const request = useBoardRequest(task.titleId, role);
  const dnd = useKanbanDnd();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description || '');
  const [assigneeId, setAssigneeId] = useState(task.assigneeStudentId || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
  const [status, setStatus] = useState<ProgressStatus>(task.status);
  const [saving, setSaving] = useState(false);

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate).getTime() < Date.now() &&
    task.status !== 'done';

  const formattedDue = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const repoUrl = safeExternalUrl(project.repoUrl);
  const deploymentUrl = safeExternalUrl(project.deploymentUrl);
  const canDrag = !!dnd && !task.deletedAt;
  const assignee = task.assigneeName || members.find((member) => member.id === task.assigneeStudentId)?.name;

  function startEditing() {
    setName(task.name);
    setDescription(task.description || '');
    setAssigneeId(task.assigneeStudentId || '');
    setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setStatus(task.status);
    setEditing(true);
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await request(`/api/${role}/tasks/${task.id}`, { method: 'DELETE' });
      toast.success('Task deleted');
      setOpen(false);
      setConfirmDelete(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete task');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      await request(`/api/${role}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          assigneeStudentId: assigneeId === (task.assigneeStudentId || '') ? undefined : assigneeId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          status,
        }),
      });
      toast.success('Task updated');
      setOpen(false);
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (saving) return;
      setOpen(next);
      if (!next) {
        setEditing(false);
        setConfirmDelete(false);
      }
    }}>
      <DialogTrigger asChild>
        <button
          type="button"
          draggable={canDrag}
          aria-label={task.name}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', task.id);
            e.dataTransfer.effectAllowed = 'move';
            dnd?.beginHtml5Drag(task.id);
          }}
          onDragEnd={() => dnd?.endDrag()}
          onPointerDown={(e) => dnd?.onCardPointerDown(e, task.id, task.name)}
          onClick={(e) => {
            if (e.detail > 0 && dnd?.wasDragged()) e.preventDefault();
          }}
          className={`block w-full cursor-pointer space-y-2.5 rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dnd?.draggingId === task.id ? 'opacity-60' : ''}`}
        >
          <span className="flex items-start gap-2">
            {canDrag && <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />}
            <span className="min-w-0 break-words text-sm font-medium leading-snug">{task.name}</span>
          </span>

          {task.description && (
            <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </span>
          )}

          <span className="flex flex-wrap items-center gap-1.5 pt-1">
            {assignee ? (
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] gap-1">
                <User className="h-3 w-3" />
                {assignee}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Unassigned
              </span>
            )}

            {formattedDue && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${isOverdue ? 'text-destructive' : ''}`}>
                {isOverdue ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                {isOverdue ? `Overdue (${formattedDue})` : formattedDue}
              </span>
            )}
            {role === 'prof' && <span className="text-xs text-muted-foreground">{PROGRESS_LABELS[task.status]}</span>}
            {task.deletedAt && <span className="text-xs text-destructive">Deleted</span>}
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle className="break-words">{editing ? 'Edit Task' : task.name}</DialogTitle>
          <DialogDescription>{project.text}</DialogDescription>
        </DialogHeader>
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); void handleSave(); }} className="space-y-3.5">
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="task-edit-name">Task Name</Label>
                <Input
                  id="task-edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Design database schema"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-edit-desc">Description</Label>
                <Textarea
                  id="task-edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details, requirements, checklist..."
                  className="min-h-20 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="task-edit-assignee">Assignee</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                    id="task-edit-assignee"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {task.assigneeStudentId && !members.some((member) => member.id === task.assigneeStudentId) && (
                      <option value={task.assigneeStudentId}>{assignee || 'Current assignee'}</option>
                    )}
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.idNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-edit-due">Due Date</Label>
                  <Input
                    id="task-edit-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-edit-status">Status</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                  id="task-edit-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProgressStatus)}
                >
                  {PROGRESS_STATUSES.map((value) => (
                    <option key={value} value={value}>{PROGRESS_LABELS[value]}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Description</p>
                <p className="whitespace-pre-wrap break-words text-muted-foreground">{task.description || 'No description'}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 break-words [&_dd]:text-muted-foreground [&_dt]:font-medium">
                <div><dt>Status</dt><dd>{PROGRESS_LABELS[task.status]}{task.deletedAt && ' · Deleted'}</dd></div>
                <div><dt>Assignee</dt><dd>{assignee || 'Unassigned'}</dd></div>
                <div><dt>Due date</dt><dd>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</dd></div>
                <div><dt>Created</dt><dd>{new Date(task.createdAt).toLocaleDateString()}</dd></div>
                {task.updatedAt && <div><dt>Last updated</dt><dd>{new Date(task.updatedAt).toLocaleDateString()}</dd></div>}
                <div>
                  <dt>Repository</dt>
                  <dd>{repoUrl ? <a className="text-primary underline" href={repoUrl} target="_blank" rel="noreferrer">Open repository</a> : 'No repository linked'}</dd>
                </div>
                {deploymentUrl && (
                  <div>
                    <dt>Deployment</dt>
                    <dd><a className="text-primary underline" href={deploymentUrl} target="_blank" rel="noreferrer">Open deployment</a></dd>
                  </div>
                )}
              </dl>
            </div>
            {confirmDelete && <p role="alert" className="text-sm">Delete this task from the board?</p>}
            {!task.deletedAt && <DialogFooter>
              {confirmDelete ? (
                <>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  <Button type="button" variant="destructive" disabled={saving} onClick={handleDelete}>
                    {saving ? 'Deleting…' : 'Confirm delete'}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>Delete task</Button>
                  <Button type="button" onClick={startEditing}>Edit task</Button>
                </>
              )}
            </DialogFooter>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
