'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { LeaveRequestsPanel, type LeaveRequestRow } from '@/components/dashboard/leave-requests-panel';
import { TitleEditor, type ProfTitle } from '@/components/dashboard/title-editor';
import { ProgressBoard, STATUS_STYLES, type BoardTitle } from '@/components/dashboard/progress-board';
import { TitleReviewDialog } from '@/components/dashboard/title-review';
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

type Slot = {
  id: string;
  label: string;
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

type Student = {
  id: string;
  name: string;
  idNumber: string;
  password: string;
  memberships?: { groupId: string; slotId: string }[];
};

type Title = ProfTitle & BoardTitle & {
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
  const [cls, setCls] = useState<{ name: string; term: string } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [leaveSchemaMissing, setLeaveSchemaMissing] = useState(false);
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [editing, setEditing] = useState<Title | null>(null);
  const [reviewing, setReviewing] = useState<Title | null>(null);
  const [highlightStudentId, setHighlightStudentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

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

  async function loadTitles(id: string) {
    setTitlesLoading(true);
    const res = await fetch(`/api/dashboard/${classId}/${id}/titles`);
    if (res.ok) setTitles((await res.json()).titles);
    setTitlesLoading(false);
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
    if (slotId && (tab === 'board' || tab === 'verified')) loadTitles(slotId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, slotId, tab]);

  useEffect(() => {
    if (!highlightStudentId || titles.length === 0) return;
    const match = titles.find((t) => t.members.some((m) => m.id === highlightStudentId));
    if (!match) return;
    const el = document.getElementById(`group-card-${match.groupId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightStudentId, titles, tab]);

  const selectedSlot = slots.find((s) => s.id === slotId) || null;
  const verified = titles.filter((t) => t.status === 'verified');

  async function setProgress(titleId: string, progressStatus: ProgressStatus) {
    const res = await fetch(`/api/dashboard/titles/${titleId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressStatus }),
    });
    if (res.ok && slotId) loadTitles(slotId);
  }

  async function decide(titleId: string, decision: 'verified' | 'rejected') {
    await fetch(`/api/dashboard/titles/${titleId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        comment: decision === 'rejected' ? comments[titleId] : undefined,
      }),
    });
    if (slotId) loadTitles(slotId);
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

  const studentLoginLink =
    typeof window !== 'undefined' ? `${window.location.origin}/c/${classId}/login` : '';

  const tabs: { id: Tab; label: string }[] = [
    { id: 'board', label: 'Board' },
    { id: 'verified', label: 'Verified Titles' },
    { id: 'roster', label: `Roster / Students (${students.length})` },
    { id: 'settings', label: 'Settings / Rules' },
    { id: 'leaves', label: `Leave Requests${leaveRequests.length ? ` (${leaveRequests.length})` : ''}` },
  ];

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
          <p className="text-muted">{studentLoginLink}</p>
        </div>
        <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(studentLoginLink)}>
          Copy
        </button>
      </div>

      {slots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="label mb-0">Project slot</label>
          <select
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
        <RosterTab classId={classId} students={students} onChange={loadAll} onOpenStudent={openStudentOnBoard} />
      ) : tab === 'settings' ? (
        <SlotsTab classId={classId} slots={slots} onChange={loadAll} />
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

      {tab === 'board' && titles.some((t) => t.status === 'pending') && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Pending verification</h2>
          <div className="grid gap-3">
            {titles
              .filter((t) => t.status === 'pending')
              .map((t) => (
                <div key={t.id} className="card space-y-2">
                  <p className="font-medium">{t.text}</p>
                  <p className="text-sm text-muted">{t.description}</p>
                  <ProgressSelect
                    value={t.progressStatus}
                    onChange={(next) => setProgress(t.id, next as ProgressStatus)}
                  />
                  <input
                    className="input"
                    placeholder="Optional reject comment"
                    value={comments[t.id] || ''}
                    onChange={(e) => setComments((cur) => ({ ...cur, [t.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={() => decide(t.id, 'verified')}>
                      Approve
                    </button>
                    <button className="btn-danger" onClick={() => decide(t.id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
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

function RosterTab({
  classId,
  students,
  onChange,
  onOpenStudent,
}: {
  classId: string;
  students: Student[];
  onChange: () => void;
  onOpenStudent: (student: Student) => void;
}) {
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function doImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/classes/${classId}/students/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: importText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setImportText('');
    setShowImport(false);
    onChange();
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/classes/${classId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, idNumber }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setName('');
    setIdNumber('');
    onChange();
  }

  async function updateField(studentId: string, field: 'name' | 'idNumber' | 'password', value: string) {
    await fetch(`/api/classes/${classId}/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  function exportCsv() {
    const header = 'Name,ID Number,Password\n';
    const rows = students.map((s) => `"${s.name}","${s.idNumber}","${s.password}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roster.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <button className="btn-secondary" onClick={() => setShowImport((s) => !s)}>
          Import .txt
        </button>
        <button className="btn-secondary" onClick={exportCsv} disabled={students.length === 0}>
          Export roster CSV
        </button>
      </div>
      {showImport && (
        <form onSubmit={doImport} className="card space-y-3">
          <label className="label">One name per line</label>
          <textarea
            className="input h-32"
            required
            placeholder={'Juan Dela Cruz\nMaria Santos\n...'}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Import students
          </button>
        </form>
      )}
      <form onSubmit={addOne} className="card flex items-end gap-3">
        <div className="flex-1">
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label">ID number</label>
          <input className="input" required value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary">
          Add student
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
      {students.length === 0 ? (
        <p className="text-sm text-muted">No students yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">ID number</th>
                <th className="py-2 pr-4">Password</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <EditableRow key={s.id} student={s} onSave={updateField} onOpen={() => onOpenStudent(s)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditableRow({
  student,
  onSave,
  onOpen,
}: {
  student: Student;
  onSave: (id: string, field: 'name' | 'idNumber' | 'password', value: string) => void;
  onOpen: () => void;
}) {
  const [name, setName] = useState(student.name);
  const [idNumber, setIdNumber] = useState(student.idNumber);
  const [password, setPassword] = useState(student.password);

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-1.5 pr-4">
        <button type="button" className="text-left font-medium text-accent hover:underline mb-1" onClick={onOpen}>
          Open on board
        </button>
        <input
          className="input py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== student.name && onSave(student.id, 'name', name)}
        />
      </td>
      <td className="py-1.5 pr-4">
        <input
          className="input py-1"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          onBlur={() => idNumber !== student.idNumber && onSave(student.id, 'idNumber', idNumber)}
        />
      </td>
      <td className="py-1.5 pr-4">
        <input
          className="input py-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => password !== student.password && onSave(student.id, 'password', password)}
        />
      </td>
    </tr>
  );
}
