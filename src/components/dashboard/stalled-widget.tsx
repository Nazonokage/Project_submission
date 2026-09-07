'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type StalledTask = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  titleId: string;
  titleText: string;
  slotId: string;
  slotLabel: string;
  groupId: string;
  assigneeName: string | null;
  assigneeIdNumber: string | null;
};

export function StalledWidget({ classId }: { classId: string }) {
  const [tasks, setTasks] = useState<StalledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholdDays, setThresholdDays] = useState(7);

  const loadStalled = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prof/tasks/stalled?classId=${classId}&days=${thresholdDays}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.stalledTasks || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [classId, thresholdDays]);

  useEffect(() => {
    loadStalled();
  }, [loadStalled]);

  function daysInactive(updatedAt: string) {
    const diffMs = Date.now() - new Date(updatedAt).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  return (
    <Card className="rounded-xl shadow-xs border">
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-warn" />
          <CardTitle className="text-base font-semibold">
            Stalled Tasks ({tasks.length})
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Inactive &gt; {thresholdDays}d</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={loadStalled}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh stalled tasks</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-ok" />
            <span>All tasks are active and moving forward.</span>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {tasks.map((t) => {
              const inactive = daysInactive(t.updatedAt);
              return (
                <div key={t.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.slotLabel} · {t.titleText}
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-[10px] shrink-0 font-normal">
                      {inactive} days inactive
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {t.status.replace('_', ' ')}
                    </Badge>
                    {t.assigneeName && (
                      <span>Assignee: {t.assigneeName}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
