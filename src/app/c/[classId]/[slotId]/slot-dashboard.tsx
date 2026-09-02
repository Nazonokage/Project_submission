'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Clock,
  FolderPlus,
  Hourglass,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StudentHeader } from '@/components/student/student-header';
import { GroupMembers } from '@/components/student/group-members';
import { TitleCard } from '@/components/student/title-card';
import { EmptyState } from '@/components/student/empty-state';
import { StatusBadge } from '@/components/student/status-badge';
import { TechStackInput } from '@/components/student/tech-stack-input';
import type { Group, LeaveRequest, Member, ProjectTitle, SlotInfo, VerifiedTitle } from '@/components/student/types';

type Invite = { invite: { id: string }; groupId: string; invitedBy: { name: string } };

function deadlineInfo(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  const formatted = d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  if (ms < 0) return { formatted, past: true, countdown: null as string | null };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const countdown = days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h left` : 'Due soon';
  return { formatted, past: false, countdown };
}

export function SlotDashboard({ classId, slotId }: { classId: string; slotId: string }) {
  const router = useRouter();
  const [className, setClassName] = useState<string | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotInfo | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [leaveRequest, setLeaveRequest] = useState<LeaveRequest | null>(null);
  const [without, setWithout] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [titles, setTitles] = useState<ProjectTitle[]>([]);
  const [verified, setVerified] = useState<VerifiedTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('group');

  const loadAll = useCallback(async () => {
    const groupRes = await fetch(`/api/student/groups?slotId=${slotId}`);
    if (groupRes.status === 401) {
      router.push(`/c/${classId}/login`);
      return;
    }

    const [slotsRes, classRes, withoutRes, invitesRes, titlesRes, verifiedRes] = await Promise.all([
      fetch('/api/student/slots'),
      fetch(`/api/student/class-info?classId=${classId}`),
      fetch(`/api/student/without-group?slotId=${slotId}`),
      fetch(`/api/student/invites?slotId=${slotId}`),
      fetch(`/api/student/titles?slotId=${slotId}`),
      fetch(`/api/student/titles/verified?slotId=${slotId}`),
    ]);

    if (groupRes.ok) {
      const data = await groupRes.json();
      setGroup(data.group);
      setMembers(data.members || []);
      setLeaveRequest(data.leaveRequest ?? null);
    }
    if (slotsRes.ok) {
      const data = await slotsRes.json();
      const found = (data.slots as SlotInfo[]).find((s) => s.id === slotId) || null;
      setSlot(found);
    }
    if (classRes.ok) {
      const data = await classRes.json();
      setClassName(data.class?.name ?? null);
      setTerm(data.class?.term ?? null);
    }
    if (withoutRes.ok) setWithout((await withoutRes.json()).students || []);
    if (invitesRes.ok) setInvites((await invitesRes.json()).invites || []);
    if (titlesRes.ok) setTitles((await titlesRes.json()).titles || []);
    if (verifiedRes.ok) setVerified((await verifiedRes.json()).titles || []);
    setLoading(false);
  }, [classId, slotId, router]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function logout() {
    await fetch('/api/student/logout', { method: 'POST' });
    router.push(`/c/${classId}/login`);
  }

  async function createGroup() {
    setCreating(true);
    try {
      const res = await fetch('/api/student/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create group');
      toast.success('Group created — you can submit titles now');
      await loadAll();
      setTab('titles');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not create group');
    } finally {
      setCreating(false);
    }
  }

  async function respond(inviteId: string, action: 'accept' | 'decline') {
    try {
      const res = await fetch(`/api/student/invites/${inviteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not respond');
      toast.success(action === 'accept' ? 'Joined the group' : 'Invite declined');
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not respond');
    }
  }

  const deadline = deadlineInfo(slot?.deadline ?? null);
  const requiredMin = slot?.titlesRequiredMin ?? 0;
  const progressValue =
    requiredMin > 0 ? Math.min(100, (Math.min(titles.length, requiredMin) / requiredMin) * 100) : 0;
  const hasGroup = Boolean(group);

  useEffect(() => {
    if (!hasGroup && tab === 'titles') setTab('group');
  }, [hasGroup, tab]);

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <StudentHeader
        title={slot?.label || 'Project slot'}
        subtitle={[className, term].filter(Boolean).join(' · ') || undefined}
        backHref={`/c/${classId}`}
        backLabel="All slots"
        onLogout={logout}
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card className="shadow-sm rounded-xl">
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {group ? (
                  <StatusBadge kind="group" status={group.status} />
                ) : (
                  <Badge variant="secondary">No group yet</Badge>
                )}
                {group && (
                  <span className="text-sm text-muted">
                    {members.length}/{group.maxSize} members
                  </span>
                )}
                {slot?.locked && <Badge variant="destructive">Slot locked</Badge>}
              </div>
              {deadline && (
                <div className="flex items-start gap-2 text-sm">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p>Deadline: {deadline.formatted}</p>
                    {deadline.past ? (
                      <Alert variant="warning" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>This deadline has passed.</AlertDescription>
                      </Alert>
                    ) : (
                      <p className="text-muted">{deadline.countdown}</p>
                    )}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm mb-2">
                  Titles: {titles.length} / {requiredMin} required
                  {slot ? ` (max ${slot.titlesAllowedMax})` : ''}
                </p>
                <Progress value={progressValue} />
              </div>
            </CardContent>
          </Card>

          {invites.length > 0 && !group && (
            <Card className="shadow-sm rounded-xl">
              <CardHeader>
                <CardTitle className="text-base">Group invites</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invites.map((inv) => (
                  <div key={inv.invite.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-sm">{inv.invitedBy.name} invited you to their group</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => respond(inv.invite.id, 'accept')}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => respond(inv.invite.id, 'decline')}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="group">My Group</TabsTrigger>
              <TabsTrigger value="titles" disabled={!hasGroup}>
                Submit Titles
              </TabsTrigger>
              <TabsTrigger value="verified">Verified</TabsTrigger>
            </TabsList>
            {!hasGroup && (
              <p className="text-sm text-muted mt-2">
                Create a group or accept an invite — you can submit titles right away, even as a solo member.
              </p>
            )}

            <TabsContent value="group">
              <GroupTab
                group={group}
                members={members}
                without={without}
                creating={creating}
                leaveRequest={leaveRequest}
                showUngrouped={slot ? slot.groupSize > 1 : true}
                onCreate={createGroup}
                onReload={loadAll}
              />
            </TabsContent>

            <TabsContent value="titles">
              {group && slot ? (
                <TitlesTab
                  slotId={slotId}
                  slot={slot}
                  titles={titles}
                  onReload={loadAll}
                />
              ) : (
                <Card className="rounded-xl">
                  <CardContent>
                    <EmptyState
                      icon={FolderPlus}
                      title="Start or join a group first"
                      description="Create a group or accept an invite. You can submit titles even if you are the only member so far."
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="verified">
              <VerifiedPreview
                classId={classId}
                slotId={slotId}
                titles={verified.slice(0, 6)}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </main>
  );
}

function GroupTab({
  group,
  members,
  without,
  creating,
  leaveRequest,
  showUngrouped,
  onCreate,
  onReload,
}: {
  group: Group | null;
  members: Member[];
  without: Member[];
  creating: boolean;
  leaveRequest: LeaveRequest | null;
  showUngrouped: boolean;
  onCreate: () => void;
  onReload: () => Promise<void>;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return without;
    return without.filter(
      (s) => s.name.toLowerCase().includes(q) || s.idNumber.toLowerCase().includes(q)
    );
  }, [without, query]);

  async function invite(studentId: string) {
    if (!group) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/student/groups/${group.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send invite');
      toast.success('Invite sent');
      await onReload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not send invite');
    } finally {
      setBusy(false);
    }
  }

  async function requestLeave() {
    if (!group) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/student/groups/${group.id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit leave request');
      toast.success('Leave request sent to your professor');
      setLeaveOpen(false);
      setReason('');
      await onReload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit leave request');
    } finally {
      setBusy(false);
    }
  }

  async function cancelLeave() {
    if (!group) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/student/groups/${group.id}/leave`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not cancel request');
      toast.success('Leave request cancelled');
      await onReload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel request');
    } finally {
      setBusy(false);
    }
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Card className="rounded-xl shadow-sm">
          <CardContent>
            <EmptyState
              icon={Users}
              title="No group yet"
              description="Create a group to start submitting titles. You can work solo and invite classmates later — a full group is not required."
              action={
                <Button onClick={onCreate} disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create a group
                </Button>
              }
            />
          </CardContent>
        </Card>
        {showUngrouped && (
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Students without a group</CardTitle>
            </CardHeader>
            <CardContent>
              {without.length === 0 ? (
                <p className="text-sm text-muted">Everyone is already in a group.</p>
              ) : (
                <ul className="space-y-2">
                  {without.map((s) => (
                    <li key={s.id} className="text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted"> · {s.idNumber}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const remaining = group.maxSize - members.length;

  return (
    <>
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Your group</CardTitle>
            <p className="text-sm text-muted mt-1">
              {group.status === 'forming'
                ? remaining > 0
                  ? `${remaining} seat${remaining === 1 ? '' : 's'} still open`
                  : 'Group is full'
                : 'This group is locked'}
            </p>
          </div>
          <StatusBadge kind="group" status={group.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          {group.status === 'forming' && (
            <Alert>
              <AlertDescription>
                You can submit titles now, even if you are working solo. Invite classmates anytime until the group is full.
              </AlertDescription>
            </Alert>
          )}
          {group.status === 'locked' && (
            <Alert variant="success">
              <AlertDescription>Group is full and locked. You can keep submitting and editing titles.</AlertDescription>
            </Alert>
          )}
          <GroupMembers members={members} maxSize={group.maxSize} />
          {leaveRequest && (
            <Alert variant="warning" className="border-amber-200">
              <Hourglass className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium text-amber-950">Leave request pending confirmation</p>
                <p className="mt-1">
                  Your professor has been notified. You remain in this group — and can keep submitting titles —
                  until they approve or decline.
                </p>
                {leaveRequest.reason && (
                  <p className="mt-2 text-amber-900/80 italic">“{leaveRequest.reason}”</p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {group.status === 'forming' && (
              <Button type="button" onClick={() => setInviteOpen(true)} disabled={remaining <= 0}>
                Invite classmates
              </Button>
            )}
            {leaveRequest ? (
              <Button type="button" variant="outline" disabled={busy} onClick={cancelLeave}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel leave request
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setLeaveOpen(true)}>
                Request to leave
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a classmate</DialogTitle>
            <DialogDescription>Students who do not have a group for this slot yet.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search by name or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No students to invite.</p>
            ) : (
              filtered.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted">{s.idNumber}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => invite(s.id)}>
                    Invite
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to leave this group</DialogTitle>
            <DialogDescription>
              This does not remove you immediately. Your professor must confirm the request. You stay a member
              and keep access to titles until they decide.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-secondary/60 px-3 py-2 text-sm">
            If you are the last remaining member and the request is approved, this group and its titles will be
            removed.
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Reason for leaving (optional)</Label>
            <Textarea
              id="leave-reason"
              className="min-h-24"
              maxLength={500}
              placeholder="e.g. Switching to another group, schedule conflict…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted">{reason.length}/500</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>
              Stay in group
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={requestLeave}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TitlesTab({
  slotId,
  slot,
  titles,
  onReload,
}: {
  slotId: string;
  slot: SlotInfo;
  titles: ProjectTitle[];
  onReload: () => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [targetUsers, setTargetUsers] = useState('');
  const [dupWarning, setDupWarning] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const atMax = titles.length >= slot.titlesAllowedMax;

  useEffect(() => {
    if (text.trim().length < 3) {
      setDupWarning([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/student/titles/check?slotId=${slotId}&text=${encodeURIComponent(text)}`
      );
      if (res.ok) {
        const data = await res.json();
        setDupWarning((data.matches || []).map((m: { text: string }) => m.text));
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [text, slotId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (slot.requireTechStack && techStack.length === 0) {
        throw new Error('Add at least one tech stack tag');
      }
      const res = await fetch('/api/student/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId,
          text,
          description,
          techStack,
          targetUsers: targetUsers.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit title');
      toast.success(data.warnings?.length ? 'Submitted with a similarity warning' : 'Title submitted');
      setText('');
      setDescription('');
      setTechStack([]);
      setTargetUsers('');
      await onReload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not submit title');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!atMax && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Submit a project title</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title-text">Title</Label>
                <Input id="title-text" required value={text} onChange={(e) => setText(e.target.value)} />
                {dupWarning.length > 0 && (
                  <Alert variant="warning">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Similar title{dupWarning.length > 1 ? 's' : ''} already exist: {dupWarning.join('; ')}
                      {slot.duplicateCheck === 'strict' ? ' — this will be blocked on submit.' : ''}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title-desc">Description</Label>
                <Textarea
                  id="title-desc"
                  required
                  className="min-h-24"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Tech stack{slot.requireTechStack ? ' (required)' : ''}
                </Label>
                <TechStackInput value={techStack} onChange={setTechStack} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target-users">
                  Target users{slot.requireTargetUsers ? ' (required)' : ''}
                </Label>
                <Input
                  id="target-users"
                  required={slot.requireTargetUsers}
                  value={targetUsers}
                  onChange={(e) => setTargetUsers(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting || slot.locked}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {slot.locked ? 'Slot is locked' : 'Submit title'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {atMax && (
        <Alert>
          <AlertDescription>
            This group has reached the maximum of {slot.titlesAllowedMax} titles.
          </AlertDescription>
        </Alert>
      )}

      {titles.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent>
            <EmptyState
              icon={FolderPlus}
              title="No titles yet"
              description="Add a project title. Your group can still invite members while you work."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {titles.map((t) => (
            <TitleCard
              key={t.id}
              title={t}
              canEdit
              requireDeploymentUrl={slot.requireDeploymentUrl}
              onUpdated={onReload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VerifiedPreview({
  classId,
  slotId,
  titles,
}: {
  classId: string;
  slotId: string;
  titles: VerifiedTitle[];
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Verified titles</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link href={`/c/${classId}/${slotId}/verified`}>View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {titles.length === 0 ? (
          <EmptyState
            icon={Search}
            title="None verified yet"
            description="When the professor verifies titles in this slot, they will show up here."
          />
        ) : (
          <div className="grid gap-3">
            {titles.map((t) => (
              <div key={t.id} className="rounded-lg border p-4 space-y-1">
                <p className="font-medium">{t.text}</p>
                <p className="text-sm text-muted line-clamp-2">{t.description}</p>
                {t.techStack && t.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {t.techStack.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
