'use client';

import { useState } from 'react';
import { Calendar, CheckCircle2, Clock, MoreVertical, Pencil, Trash2, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressSelect } from '@/components/student/progress-select';
import type { Member, ProgressStatus, TaskItem } from '@/components/student/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function TaskCard({
  task,
  members = [],
  readOnly = false,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: TaskItem;
  members?: Member[];
  readOnly?: boolean;
  onStatusChange?: (taskId: string, status: ProgressStatus) => void;
  onEdit?: (task: TaskItem) => void;
  onDelete?: (taskId: string) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
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

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/student/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          assigneeStudentId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          status,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditOpen(false);
        onEdit?.(data.task);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card
        draggable={!readOnly}
        onDragStart={(e) => {
          if (readOnly) return;
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className={`rounded-xl shadow-xs border bg-card hover:border-primary/40 transition-colors ${
          !readOnly ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <CardContent className="p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug break-words flex-1">
              {task.name}
            </p>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => {
                  setName(task.name);
                  setDescription(task.description || '');
                  setAssigneeId(task.assigneeStudentId || '');
                  setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
                  setStatus(task.status);
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Edit task</span>
              </Button>
            )}
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {task.assigneeName ? (
              <Badge variant="secondary" className="text-[11px] font-normal gap-1 py-0.5 px-2">
                <User className="h-3 w-3" />
                {task.assigneeName}
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Unassigned
              </span>
            )}

            {formattedDue && (
              <Badge
                variant={isOverdue ? 'destructive' : 'outline'}
                className="text-[11px] font-normal gap-1 py-0.5 px-2"
              >
                {isOverdue ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                {isOverdue ? `Overdue (${formattedDue})` : formattedDue}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            <ProgressSelect
              value={task.status}
              disabled={readOnly}
              onChange={(next) => onStatusChange?.(task.id, next)}
            />
            {!readOnly && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Delete task</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Task Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
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
                <Label>Assignee</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
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
              <Label>Status</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProgressStatus)}
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !name.trim()} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
