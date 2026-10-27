'use client';

import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanDndProvider, useKanbanDnd } from '@/components/student/kanban-dnd';
import { TaskCard } from '@/components/student/task-card';
import type { Member, TaskItem } from '@/components/student/types';
import { PROGRESS_LABELS, PROGRESS_STATUSES, type ProgressStatus } from '@/lib/progress';
import { cn } from '@/lib/utils';

function KanbanColumn({
  status,
  tasks,
  members,
  loading,
  onAdd,
  onStatusChange,
  onDelete,
}: {
  status: ProgressStatus;
  tasks: TaskItem[];
  members: Member[];
  loading: boolean;
  onAdd: (status: ProgressStatus) => void;
  onStatusChange: (taskId: string, next: ProgressStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  const dnd = useKanbanDnd();
  const isOver = dnd?.overStatus === status;

  return (
    <div
      data-kanban-column={status}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dnd && dnd.overStatus !== status) dnd.setOverStatus(status);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          if (dnd?.overStatus === status) dnd.setOverStatus(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        dnd?.endDrag();
        if (taskId) onStatusChange(taskId, status);
      }}
      className={cn(
        'flex min-h-[14rem] w-[min(17.5rem,calc(100vw-2.75rem))] shrink-0 snap-start flex-col space-y-3 rounded-xl border p-3 transition-all duration-150 lg:min-w-0 lg:w-auto',
        isOver ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border/80 bg-secondary/15'
      )}
    >
      <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {PROGRESS_LABELS[status]}
          </p>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
            {tasks.length}
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground md:h-6 md:w-6"
          onClick={() => onAdd(status)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sr-only">Add task to {PROGRESS_LABELS[status]}</span>
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : tasks.length === 0 ? (
          <div
            className={cn(
              'flex h-24 items-center justify-center rounded-lg border border-dashed px-2 text-center text-xs transition-colors',
              isOver ? 'border-primary font-medium text-primary' : 'text-muted-foreground/70'
            )}
          >
            {isOver ? `Drop to move to ${PROGRESS_LABELS[status]}` : `No tasks in ${PROGRESS_LABELS[status].toLowerCase()}`}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  members,
  loading,
  onAdd,
  onStatusChange,
  onDelete,
}: {
  tasks: TaskItem[];
  members: Member[];
  loading: boolean;
  onAdd: (status: ProgressStatus) => void;
  onStatusChange: (taskId: string, next: ProgressStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  return (
    <KanbanDndProvider onMove={onStatusChange}>
      <div
        data-kanban-scroller
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:snap-none"
      >
        {PROGRESS_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasks.filter((task) => task.status === status)}
            members={members}
            loading={loading}
            onAdd={onAdd}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}
      </div>
    </KanbanDndProvider>
  );
}
