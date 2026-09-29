'use client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { boardKeys } from '@/lib/query-keys';
import { useBoardQuery } from '@/lib/board-query';
import { VerificationQueue, type VerificationTitle } from '@/components/dashboard/verification-queue';
import { titleRequest } from '@/lib/title-request';
import { ClassLifecycle } from '@/components/dashboard/class-lifecycle';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LeaveRequestsPanel, type LeaveRequestRow } from '@/components/dashboard/leave-requests-panel';
import { TitleEditor, type ProfTitle } from '@/components/dashboard/title-editor';
import { ProgressBoard, STATUS_STYLES, type BoardTitle } from '@/components/dashboard/progress-board';
import { TitleReviewDialog } from '@/components/dashboard/title-review';
import { StalledWidget } from '@/components/dashboard/stalled-widget';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProgressSelect } from '@/components/student/progress-select';
import { type ProgressStatus } from '@/lib/progress';
import {
  DEFAULT_SLOT_RULES,
  loadClassDefaults,
  saveClassDefaults,
  SlotRulesFields,
  SlotSettingsPanel,
  type SlotRules,
} from '@/components/dashboard/slot-settings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RosterTab, type RosterStudent } from '@/components/dashboard/roster-tab';

type Slot = {
  id: string;
  label: string;
  instructions?: string | null;
  groupSize: number;
  titlesRequiredMin: number;
  titlesAllowedMax: number;
  duplicateCheck: 'strict' | 'warn';
  requireTechStack: boolean;
  requireTargetUsers: boolean;
  requireDeploymentUrl: boolean;
  deadline: string | null;
  locked: boolean;
};

type Student = RosterStudent;

type Title = ProfTitle & BoardTitle & VerificationTitle & {
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  repoUrl: string | null;
};

type Tab = 'board' | 'verified' | 'roster' | 'settings' | 'leaves';

export default function ClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('board');
  const [cls, setCls] = useState<{ name: string; term: string; defaultStudentPassword?: string; archivedAt?: string | null } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [leaveSchemaMissing, setLeaveSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Title | null>(null);
  const [reviewing, setReviewing] = useState<Title | null>(null);
  const [highlightStudentId, setHighlightStudentId] = useState<string | null>(null);
  const [studentLoginLink, setStudentLoginLink] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setStudentLoginLink(`${window.location.origin}/c/${classId}/login`);
    }
  }, [classId]);

  async function loadAll() {
    setLoading(true);
    const [clsRes, slotsRes, studentsRes, leavesRes] = await Promise.all([
      fetch(`/api/classes/${classId}`),
      fetch(`/api/classes/${classId}/slots`),
      fetch(`/api/classes/${classId}/students`),
      fetch(`/api/classes/${classId}/leave-requests?status=pending`),
    ]);
    if (clsRes.ok) setCls((await clsRes.json()).class);
    let nextSlots: Slot[] = [];
    if (slotsRes.ok) {
      nextSlots = (await slotsRes.json()).slots;
      setSlots(nextSlots);
    }
    if (studentsRes.ok) setStudents((await studentsRes.json()).students);
    if (leavesRes.ok) {
      const data = await leavesRes.json();
      setLeaveRequests(data.requests || []);
      setLeaveSchemaMissing(!!data.schemaMissing);
    }
    setLoading(false);
    return nextSlots;
  }

  const client = useQueryClient();
  const titlesQuery = useBoardQuery<{ titles: Title[] }>(boardKeys.slot(classId, slotId || ''), `/api/dashboard/${classId}/${slotId}/titles`, !!slotId && (tab === 'board' || tab === 'verified'));
  const titles = titlesQuery.data?.titles || [];
  const titlesLoading = titlesQuery.isPending && !titlesQuery.data;
  async function loadTitles(id: string) {
    await client.invalidateQueries({ queryKey: boardKeys.slot(classId, id) });
  }

  useEffect(() => {
    const requestedTab = searchParams.get('tab') as Tab | null;
    const requestedSlot = searchParams.get('slot');
    const highlight = searchParams.get('highlight');
    if (requestedTab && ['board', 'verified', 'roster', 'settings', 'leaves'].includes(requestedTab)) {
      setTab(requestedTab);
    }
    if (requestedSlot) setSlotId(requestedSlot);
    if (highlight) setHighlightStudentId(highlight);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    if (slotId) return;
    if (slots[0]) setSlotId(slots[0].id);
  }, [slots, slotId]);

  useEffect(() => {
    if (!highlightStudentId || titles.length === 0) return;
    const match = titles.find((t) => t.members.some((m) => m.id === highlightStudentId));
    if (!match) return;
    const el = document.getElementById(`group-card-${match.groupId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightStudentId, titles, tab]);

  const selectedSlot = slots.find((s) => s.id === slotId) || null;
  const verified = titles.filter((t) => t.status === 'verified');

  const progressMutation = useMutation({
    mutationKey: boardKeys.slot(classId, slotId || ''),
    mutationFn: async ({ titleId, progressStatus }: { titleId: string; progressStatus: ProgressStatus; slotId: string }) => {
      const res = await fetch(`/api/dashboard/titles/${titleId}/progress`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progressStatus }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not update progress');
    },
    onError: (error) => toast.error(error.message),
    onSettled: (_data, _error, variables) => client.invalidateQueries({ queryKey: boardKeys.slot(classId, variables.slotId) }),
  });
  function setProgress(titleId: string, progressStatus: ProgressStatus) {
    if (slotId) progressMutation.mutate({ titleId, progressStatus, slotId });
  }

  async function decide(titleId: string, decision: 'verified' | 'rejected', comment?: string): Promise<boolean> {
    const affectedSlot = slotId;
    try {
      const res = await titleRequest(`/api/dashboard/titles/${titleId}/verify`, 'PATCH', {
        decision, comment: decision === 'rejected' ? comment : undefined,
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not review title');
      toast.success(decision === 'verified' ? 'Title approved' : 'Title rejected');
      await client.invalidateQueries({ queryKey: boardKeys.title('prof', titleId) });
      if (affectedSlot) await loadTitles(affectedSlot);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not review title');
      return false;
    }
  }

  async function removeTitle(title: Title) {
    const ok = window.confirm(`Delete “${title.text}”? Related progress notes for this title will also be removed.`);
    if (!ok) return;
    const res = await fetch(`/api/dashboard/titles/${title.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Could not delete title');
      return;
    }
    toast.success('Title deleted');
    if (slotId) loadTitles(slotId);
  }

  async function exportCsv() {
    if (!slotId) return;
    const status = tab === 'verified' ? 'verified' : '';
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(`/api/dashboard/${classId}/${slotId}/export${qs}`);
    if (!res.ok) {
      toast.error('Could not export');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function openStudentOnBoard(student: Student) {
    const membership =
      student.memberships?.find((m) => m.slotId === slotId) || student.memberships?.[0];
    if (!membership) {
      toast.error('This student is not in a group yet');
      return;
    }
    setSlotId(membership.slotId);
    setHighlightStudentId(student.id);
    setTab('board');
    router.replace(`/dashboard/${classId}?tab=board&slot=${membership.slotId}&highlight=${student.id}`);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'board', label: 'Board' },
    { id: 'verified', label: 'Verified Titles' },
    { id: 'roster', label: `Roster / Students (${students.length})` },
    { id: 'settings', label: 'Settings / Rules' },
    { id: 'leaves', label: `Leave Requests${leaveRequests.length ? ` (${leaveRequests.length})` : ''}` },
  ];

  function copyLoginLink() {
    const link =
      studentLoginLink || (typeof window !== 'undefined' ? `${window.location.origin}/c/${classId}/login` : '');
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success('Login link copied to clipboard');
    }
  }

  return (
    <main className={`${tab === 'board' ? 'max-w-6xl' : 'max-w-4xl'} mx-auto px-6 py-10 space-y-6`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-muted hover:underline">
            ← All classes
          </Link>
          <h1 className="text-xl font-semibold mt-1">{cls?.name || '…'}</h1>
          <p className="text-sm text-muted">{cls?.term}</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="card flex items-center justify-between text-sm">
        <div>
          <p className="font-medium">Student login link</p>
          <p className="text-muted">{studentLoginLink || `/c/${classId}/login`}</p>
        </div>
        <button className="btn-secondary" onClick={copyLoginLink}>
          Copy
        </button>
      </div>

      {slots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="label mb-0">Project slot</label>
          <select
            aria-label="Project slot"
            className="input max-w-xs"
            value={slotId || ''}
            onChange={(e) => {
              setSlotId(e.target.value);
              setHighlightStudentId(null);
            }}
          >
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {(tab === 'board' || tab === 'verified') && slotId && (
            <button className="btn-secondary" onClick={exportCsv}>
              Export CSV
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={`px-3 py-2 text-sm font-medium border-b-2 ${
              tab === item.id ? 'border-accent text-accent' : 'border-transparent text-muted'
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tab === 'board' ? (
        !selectedSlot ? (
          <p className="text-sm text-muted">Create a project slot in Settings to see the board.</p>
        ) : titlesLoading ? (
          <p className="text-sm text-muted">Loading board…</p>
        ) : (
          <div className="space-y-6">
            <StalledWidget classId={classId} />
            <ProgressBoard
              titles={titles}
              highlightStudentId={highlightStudentId}
              onProgress={setProgress}
              onOpen={(t) => setReviewing(titles.find((x) => x.id === t.id) || null)}
              onEdit={(t) => setEditing(titles.find((x) => x.id === t.id) || null)}
              onDelete={(t) => {
                const full = titles.find((x) => x.id === t.id);
                if (full) removeTitle(full);
              }}
            />
          </div>
        )
      ) : tab === 'verified' ? (
        !selectedSlot ? (
          <p className="text-sm text-muted">Create a project slot first.</p>
        ) : titlesLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : verified.length === 0 ? (
          <p className="text-sm text-muted">No verified titles yet.</p>
        ) : (
          <div className="grid gap-3">
            {verified.map((t) => (
              <div key={t.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{t.text}</p>
                    <p className="text-sm text-muted mt-0.5">{t.description}</p>
                  </div>
                  <span className={`badge ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                </div>
                <p className="text-sm text-muted">Group: {t.members.map((m) => m.name).join(', ') || '—'}</p>
                {t.latestReport && (
                  <p className="text-sm text-muted">
                    Latest report{t.latestReport.version ? ` v${t.latestReport.version}` : ''}:{' '}
                    {t.latestReport.progressSummary || '—'}
                  </p>
                )}
                <button className="btn-secondary" onClick={() => setReviewing(t)}>
                  Reports & feedback
                </button>
              </div>
            ))}
          </div>
        )
      ) : tab === 'roster' ? (
        <RosterTab
          classId={classId}
          students={students}
          defaultStudentPassword={cls?.defaultStudentPassword || '2026'}
          onChange={loadAll}
          onOpenStudent={openStudentOnBoard}
        />
      ) : tab === 'settings' ? (
        <div className="space-y-6"><SlotsTab classId={classId} slots={slots} onChange={loadAll} />{cls && <ClassLifecycle classId={classId} name={cls.name} archived={!!cls.archivedAt} onChanged={loadAll} />}</div>
      ) : (
        <div className="space-y-3">
          {leaveSchemaMissing && (
            <Alert variant="warning">
              <AlertDescription>
                Leave requests are not available yet. Run <code className="font-mono text-xs">add_pm_schema.sql</code> on
                Neon so the <code className="font-mono text-xs">group_leave_requests</code> table exists.
              </AlertDescription>
            </Alert>
          )}
          <LeaveRequestsPanel requests={leaveRequests} onChanged={loadAll} />
        </div>
      )}

      {titlesQuery.error && <p role="alert" className="text-sm text-danger">Could not refresh projects. Retrying automatically.</p>}
      {tab === 'board' && selectedSlot && !loading && !titlesLoading && (
        <VerificationQueue key={`${classId}:${slotId}`} titles={titles}
          onReview={id => setReviewing(titles.find(t => t.id === id) || null)} onDecision={decide} />
      )}

      {editing && (
        <TitleEditor
          key={editing.id}
          title={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={() => slotId && loadTitles(slotId)}
        />
      )}
      {reviewing && (
        <TitleReviewDialog
          titleId={reviewing.id}
          titleText={reviewing.text}
          open={!!reviewing}
          asProfessor
          onOpenChange={(open) => {
            if (!open) setReviewing(null);
          }}
        />
      )}
    </main>
  );
}
function SlotsTab({
  classId,
  slots,
  onChange,
}: {
  classId: string;
  slots: Slot[];
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [rules, setRules] = useState<SlotRules>(DEFAULT_SLOT_RULES);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setRules(loadClassDefaults(classId));
  }, [classId]);

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/classes/${classId}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, ...rules }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setLabel('');
    setShowForm(false);
    onChange();
  }

  async function removeSlot(id: string) {
    if (!confirm('Delete this project slot? Groups and titles under it will be deleted too.')) return;
    await fetch(`/api/classes/${classId}/slots/${id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          New project slot
        </button>
      </div>
      {showForm && (
        <form onSubmit={createSlot} className="card space-y-3">
          <div>
            <label className="label">Label</label>
            <input
              className="input"
              required
              placeholder="Project 1 - Capstone Proposal"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <SlotRulesFields rules={rules} onChange={setRules} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">
              Create slot
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                saveClassDefaults(classId, rules);
                toast.success('These rules will be used for new slots in this class');
              }}
            >
              Save as class defaults
            </button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      )}
      {slots.length === 0 ? (
        <p className="text-sm text-muted">No project slots yet.</p>
      ) : (
        <div className="grid gap-3">
          {slots.map((s) => (
            <div key={s.id} className="card space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.label}</p>
                  <p className="text-sm text-muted">
                    {s.groupSize === 1 ? 'Solo' : `Groups of ${s.groupSize}`} · titles {s.titlesRequiredMin}–
                    {s.titlesAllowedMax} · duplicate check: {s.duplicateCheck}
                    {s.locked && ' · locked'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="btn-secondary" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                    {openId === s.id ? 'Hide rules' : 'Rules'}
                  </button>
                  <button className="btn-danger" onClick={() => removeSlot(s.id)}>
                    Delete
                  </button>
                </div>
              </div>
              {openId === s.id && (
                <SlotSettingsPanel
                  classId={classId}
                  slotId={s.id}
                  initial={{
                    instructions: s.instructions,
                    groupSize: s.groupSize,
                    titlesRequiredMin: s.titlesRequiredMin,
                    titlesAllowedMax: s.titlesAllowedMax,
                    duplicateCheck: s.duplicateCheck,
                    requireTechStack: s.requireTechStack,
                    requireTargetUsers: s.requireTargetUsers,
                    requireDeploymentUrl: s.requireDeploymentUrl,
                    deadline: s.deadline,
                    locked: s.locked,
                  }}
                  onSaved={onChange}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

