'use client';

import { useState } from 'react';
import { Check, Clock3, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/student/empty-state';

export type LeaveRequestRow = {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  student: { id: string; name: string; idNumber: string };
  slot: { id: string; label: string };
  group: { id: string; status: string; maxSize: number };
};

export function LeaveRequestsPanel({
  requests,
  onChanged,
  compact,
}: {
  requests: LeaveRequestRow[];
  onChanged: () => void;
  compact?: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(id: string, decision: 'approved' | 'declined') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/dashboard/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update request');
      toast.success(decision === 'approved' ? 'Student removed from the group' : 'Leave request declined');
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update request');
    } finally {
      setBusyId(null);
    }
  }

  if (requests.length === 0) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardContent>
          <EmptyState
            icon={Clock3}
            title="No pending leave requests"
            description="When a student asks to leave a group, it will appear here for your confirmation."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {requests.map((req) => (
        <Card key={req.id} className="rounded-xl shadow-sm border-amber-200/80">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{req.student.name}</CardTitle>
                <p className="text-sm text-muted mt-0.5">ID {req.student.idNumber}</p>
              </div>
              <Badge className="border-transparent bg-amber-100 text-amber-900 shrink-0">Pending</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <p className="flex items-center gap-2 text-muted">
                <UserRound className="h-4 w-4 shrink-0" />
                {req.slot.label}
              </p>
              <p className="flex items-center gap-2 text-muted">
                <Clock3 className="h-4 w-4 shrink-0" />
                {new Date(req.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
            {req.reason ? (
              <blockquote className="rounded-lg border bg-secondary/50 px-3 py-2 text-sm leading-relaxed">
                {req.reason}
              </blockquote>
            ) : (
              <p className="text-sm text-muted">No reason provided.</p>
            )}
            {!compact && (
              <p className="text-xs text-muted">
                Approving removes this student from the group. If they are the last member, the group and its
                titles are deleted.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busyId === req.id}
                onClick={() => decide(req.id, 'approved')}
              >
                <Check className="h-4 w-4" />
                Confirm leave
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === req.id}
                onClick={() => decide(req.id, 'declined')}
              >
                <X className="h-4 w-4" />
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
