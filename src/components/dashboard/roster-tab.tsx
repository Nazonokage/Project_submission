'use client';

import { useMemo, useRef, useState } from 'react';
import { StudentPassword } from './student-password';
import Link from 'next/link';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type SlotProgress = {
  slotId: string; slotLabel: string; inGroup: boolean; groupId: string | null;
  pendingCount: number; verifiedCount: number; rejectedCount: number;
  latestTitleText?: string | null;
  enrolled?: boolean;
  members?: { id: string; name: string; idNumber: string }[];
  titles?: { id: string; text: string; status: string }[];
};

export type RosterStudent = {
  slotProgress?: SlotProgress[];
  id: string;
  name: string;
  idNumber: string;
  password?: never;
  isActive?: boolean;
  lastLoginAt?: string | null;
  memberships?: { groupId: string; slotId: string }[];
};

export function RosterTab({
  classId,
  students,
  defaultStudentPassword,
  onChange,
  onOpenStudent,
  selectedSlotId,
  selectedSlotLabel,
}: {
  classId: string;
  students: RosterStudent[];
  defaultStudentPassword: string;
  onChange: () => void;
  onOpenStudent: (student: RosterStudent) => void;
  selectedSlotId?: string | null;
  selectedSlotLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showExcluded, setShowExcluded] = useState(false);
  const enrolled = (student: RosterStudent) => !selectedSlotId || student.slotProgress?.find(progress => progress.slotId === selectedSlotId)?.enrolled !== false;
  const progressFor = (student: RosterStudent) => (student.slotProgress || []).filter(progress => !selectedSlotId || progress.slotId === selectedSlotId);
  const [credentials, setCredentials] = useState<{ name: string; idNumber: string; initialPassword: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = students.find((student) => student.id === selectedId) || null;
  const rowTrigger = useRef<HTMLTableRowElement | null>(null);
  function closeDetails() {
    setSelectedId(null);
    setEditing(null);
    setError(null);
  }

  // Count duplicate student names in this class (case-insensitive & trimmed)
  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) {
      const key = s.name.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [students]);

  const hasDuplicate = (s: RosterStudent) => (duplicateNameCounts.get(s.name.trim().toLowerCase()) || 0) > 1;
  const totalDuplicatesCount = useMemo(() => {
    return students.filter(s => (duplicateNameCounts.get(s.name.trim().toLowerCase()) || 0) > 1).length;
  }, [students, duplicateNameCounts]);

  const filteredStudents = students.filter((s) => {
    const matches = `${s.name} ${s.idNumber}`.toLowerCase().includes(search.trim().toLowerCase());
    const progress = progressFor(s).filter(p => p.enrolled !== false);
    return matches && (enrolled(s) || showExcluded) && (filter === 'all' ||
      (filter === 'no-group' && enrolled(s) && (selectedSlotId ? !s.memberships?.some(m => m.slotId === selectedSlotId) : !s.memberships?.length)) ||
      (filter === 'never' && !s.lastLoginAt) ||
      (filter === 'pending' && progress.some((p) => p.pendingCount > 0)) ||
      (filter === 'verified' && progress.some((p) => p.verifiedCount > 0)) ||
      (filter === 'duplicates' && hasDuplicate(s)));
  });
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RosterStudent | null>(null);
  const [editName, setEditName] = useState('');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Check import duplicates against current roster and within the pasted text itself
  const importDuplicates = useMemo(() => {
    const rawNames = importText.split('\n').map(n => n.trim()).filter(Boolean);
    const existingMatches = new Set<string>();
    const seenInImport = new Set<string>();
    const withinImportDupes = new Set<string>();
    const rosterNames = new Set(students.map(s => s.name.trim().toLowerCase()));

    for (const n of rawNames) {
      const lower = n.toLowerCase();
      if (rosterNames.has(lower)) existingMatches.add(n);
      if (seenInImport.has(lower)) withinImportDupes.add(n);
      seenInImport.add(lower);
    }

    return {
      existing: Array.from(existingMatches),
      withinImport: Array.from(withinImportDupes),
    };
  }, [importText, students]);

  async function doImport(e: React.FormEvent) {
    e.preventDefault();
    if (importDuplicates.existing.length > 0 || importDuplicates.withinImport.length > 0) {
      const msgs = [];
      if (importDuplicates.existing.length > 0) {
        msgs.push(`${importDuplicates.existing.length} name(s) already exist in this class:\n• ${importDuplicates.existing.slice(0, 5).join('\n• ')}${importDuplicates.existing.length > 5 ? `\n...and ${importDuplicates.existing.length - 5} more` : ''}`);
      }
      if (importDuplicates.withinImport.length > 0) {
        msgs.push(`${importDuplicates.withinImport.length} name(s) appear multiple times in the import list:\n• ${importDuplicates.withinImport.slice(0, 5).join('\n• ')}${importDuplicates.withinImport.length > 5 ? `\n...and ${importDuplicates.withinImport.length - 5} more` : ''}`);
      }
      const confirmed = window.confirm(`Warning: duplicate names detected!\n\n${msgs.join('\n\n')}\n\nDo you want to proceed anyway?`);
      if (!confirmed) return;
    }
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
    setCredentials(data.credentials || []);
    setImportText('');
    setShowImport(false);
    toast.success(`Imported ${data.count} students`);
    onChange();
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const existing = students.find(s => s.name.trim().toLowerCase() === lower);
    if (existing) {
      const confirmed = window.confirm(`A student named "${existing.name}" (ID: ${existing.idNumber}) is already in this class.\n\nAre you sure you want to add another student with the same name?`);
      if (!confirmed) return;
    }
    setError(null);
    const res = await fetch(`/api/classes/${classId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setCredentials([{ name: data.student.name, idNumber: data.student.idNumber, initialPassword: data.initialPassword }]);
    setName('');
    toast.success(`Added ${data.student?.name} as ${data.student?.idNumber}`);
    onChange();
  }

  function openEdit(student: RosterStudent) {
    setError(null);
    setEditing(student);
    setEditName(student.name);
    setEditIdNumber(student.idNumber);
    setEditPassword('');
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setError(null);
    const res = await fetch(`/api/classes/${classId}/students/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName,
        idNumber: editIdNumber,
        ...(editPassword ? { password: editPassword } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingEdit(false);
    if (!res.ok) {
      setError(data.error || 'Could not save student');
      return;
    }
    setEditing(null);
    toast.success('Student updated');
    onChange();
  }

  async function deleteStudent() {
    if (!editing) return;
    if (!confirm(`Delete ${editing.name} from this class?`)) return;
    const res = await fetch(`/api/classes/${classId}/students/${editing.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not delete student');
      return;
    }
    setEditing(null);
    setSelectedId(null);
    toast.success('Student deleted');
    onChange();
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const response = await fetch(`/api/classes/${classId}/students/export`, { cache: 'no-store' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not export roster');
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'roster.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not export roster'); }
    finally { setExporting(false); }
  }

  return (
    <div className="space-y-4">
      <Dialog open={credentials.length > 0} onOpenChange={open => { if (!open) setCredentials([]); }}>
        <DialogContent><DialogHeader><DialogTitle>Save new student credentials</DialogTitle><DialogDescription>Share each credential privately with its student. Passwords can also be viewed or exported from this roster.</DialogDescription></DialogHeader>
          <div className="max-h-80 overflow-auto space-y-3">{credentials.map(c => <div key={c.idNumber} className="rounded-lg border border-line p-3"><p>{c.name} / {c.idNumber}</p><code className="select-all break-all">{c.initialPassword}</code></div>)}</div>
          <button type="button" className="btn-primary" onClick={() => setCredentials([])}>I have saved the credentials</button>
        </DialogContent>
      </Dialog>
      <details className="rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium touch-manipulation">Manage roster</summary>
        <div className="mt-4 space-y-4">
      <p className="text-sm text-muted">New students start with password 2026. View a student&apos;s password in their details, or export the roster with passwords.</p>
      <div className="flex justify-between">
        <button className="btn-secondary" onClick={() => setShowImport((s) => !s)}>
          Import .txt
        </button>
        <button className="btn-secondary" onClick={exportCsv} disabled={exporting || students.length === 0}>
          {exporting ? 'Exporting…' : 'Export roster CSV'}
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
          {(importDuplicates.existing.length > 0 || importDuplicates.withinImport.length > 0) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/60 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Duplicate names detected</span>
              </div>
              {importDuplicates.existing.length > 0 && (
                <p>Already in class: <strong>{importDuplicates.existing.join(', ')}</strong></p>
              )}
              {importDuplicates.withinImport.length > 0 && (
                <p>Duplicate in paste: <strong>{importDuplicates.withinImport.join(', ')}</strong></p>
              )}
            </div>
          )}
          <p className="text-sm text-muted">IDs continue from the current roster. Password = class default.</p>
          <button type="submit" className="btn-primary">
            Import students
          </button>
        </form>
      )}
      <form onSubmit={addOne} className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[12rem]">
            <label className="label">Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">
            Add student
          </button>
        </div>
        {name.trim() && students.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase()) && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>A student with this name already exists in this class.</span>
          </div>
        )}
        <p className="w-full text-sm text-muted">ID is auto-generated. Password uses the class default.</p>
      </form>
        </div>
      </details>
      {error && !selected && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search students by name or ID" className="input max-w-xs" placeholder="Search name or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
        {([['all', 'All'], ['no-group', 'No group'], ['never', 'Never logged in'], ['pending', 'Has pending'], ['verified', 'Has verified']] as const).map(([value, label]) => (
          <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter(value)}>{label}</button>
        ))}
        {totalDuplicatesCount > 0 && (
          <button
            type="button"
            aria-pressed={filter === 'duplicates'}
            className={filter === 'duplicates' ? 'btn-primary bg-amber-600 border-amber-600 hover:bg-amber-700' : 'btn-secondary text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/60'}
            onClick={() => setFilter(filter === 'duplicates' ? 'all' : 'duplicates')}
          >
            Duplicates ({totalDuplicatesCount})
          </button>
        )}

      </div>
      {selectedSlotId && <div className="space-y-2 text-sm">
        <p className="text-muted">{students.filter(enrolled).length} enrolled in {selectedSlotLabel || 'this slot'} · {students.filter(student => !enrolled(student)).length} not enrolled</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showExcluded} onChange={event => setShowExcluded(event.target.checked)} />Show students not enrolled in this slot</label>
      </div>}
      {filteredStudents.length === 0 ? (
        <p className="text-sm text-muted">No matching students.</p>
      ) : (
        <div className="overflow-auto max-h-[70vh] rounded-2xl border border-line bg-card shadow-sm">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Student roster. Select a row to view details and manage the student.</caption>
            <thead className="roster-material sticky top-0 z-10 text-xs font-medium tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-5 py-3">Student</th>
                <th scope="col" className="px-5 py-3">ID number</th>
                <th scope="col" className="px-5 py-3">Group members</th>
                <th scope="col" className="px-5 py-3">Project title</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} tabIndex={0} aria-label={`View ${student.name}`} aria-haspopup="dialog"
                  onClick={(event) => { rowTrigger.current = event.currentTarget; setSelectedId(student.id); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault(); rowTrigger.current = event.currentTarget; setSelectedId(student.id);
                    }
                  }}
                  className="interactive-row cursor-pointer touch-manipulation border-t border-line/60 align-top hover:bg-secondary/50 active:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2">
                  <th scope="row" className="px-5 py-4 font-medium min-w-[10rem]">
                    <div className="flex flex-col items-start gap-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="underline decoration-dotted underline-offset-4">{student.name}</span>
                        <ChevronRight aria-hidden="true" className="row-chevron h-4 w-4 shrink-0" />
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {hasDuplicate(student) && (
                          <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Duplicate name
                          </span>
                        )}
                        {student.isActive === false && (
                          <span className="text-xs font-normal text-muted">Inactive</span>
                        )}
                      </div>
                    </div>
                  </th>
                  <td className="px-5 py-4 font-mono tabular-nums whitespace-nowrap">{student.idNumber}</td>
                  <td className="px-5 py-4 min-w-[13rem]">
                    {progressFor(student).filter((slot) => slot.inGroup && slot.enrolled !== false).map((slot) => (
                      <div key={slot.slotId} className="mb-2 last:mb-0">
                        <p className="text-xs text-muted mb-1">{slot.slotLabel}</p>
                        <p>{slot.members?.filter((member) => member.id !== student.id).map((member) => `${member.name} (${member.idNumber})`).join(', ') || 'Solo project'}</p>
                      </div>
                    ))}
                    {!enrolled(student) ? <span className="text-muted">Not enrolled in this slot</span> : !progressFor(student).some(slot => slot.inGroup) && <span className="text-muted">No group</span>}
                  </td>
                  <td className="px-5 py-4 min-w-[15rem]">
                    {progressFor(student).map((slot) => (
                      <div key={slot.slotId} className="mb-2 last:mb-0">
                        <p className="text-xs text-muted mb-1">{slot.slotLabel}</p>
                        {slot.enrolled === false ? <p className="text-muted">Not required for this slot</p> : slot.titles?.length ? slot.titles.map((title) => <p key={title.id} className="leading-relaxed">{title.text}</p>) : <p className="text-muted">{slot.latestTitleText || 'No project yet'}</p>}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="roster-detail max-w-2xl w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto rounded-3xl shadow-2xl"
          onCloseAutoFocus={(event) => { event.preventDefault(); rowTrigger.current?.focus(); }}>
          {editing ? <form onSubmit={saveEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit student</DialogTitle>
              <DialogDescription>Save sends a single update. Cancel discards changes.</DialogDescription>
            </DialogHeader>
            <div>
              <label htmlFor="roster-edit-name" className="label">Name</label>
              <input id="roster-edit-name" className="input" required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="roster-edit-id" className="label">ID number</label>
              <input id="roster-edit-id" className="input" required value={editIdNumber} onChange={(e) => setEditIdNumber(e.target.value)} />
            </div>
            <div>
              <label htmlFor="roster-edit-password" className="label">Password</label>
              <input id="roster-edit-password" className="input" type="password" placeholder="2026 or a password of at least 12 characters; blank keeps current" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DialogFooter className="gap-2">
              <button type="button" className="btn-danger mr-auto" onClick={deleteStudent}>
                Delete
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </DialogFooter>
          </form> : selected && <>
            <DialogHeader className="pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-2xl tracking-tight leading-tight">{selected.name}</DialogTitle>
                {hasDuplicate(selected) && (
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Duplicate name in class
                  </span>
                )}
              </div>
              <DialogDescription>Student details · <span className="font-mono">{selected.idNumber}</span></DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl bg-secondary/40 p-4 space-y-2 text-sm">
              <StudentPassword key={selected.id} classId={classId} studentId={selected.id} />
              <p className="text-muted">{selected.lastLoginAt ? `Last login ${new Date(selected.lastLoginAt).toLocaleString()}` : 'Never logged in'}</p>
              {selected.isActive === false && <p className="text-danger">Inactive student</p>}
            </div>
            <div className="space-y-4">
              {(selected.slotProgress || []).map((slot) => <section key={slot.slotId} className="rounded-2xl border border-line p-4 space-y-2">
                <h3 className="font-semibold text-sm">{slot.slotLabel}</h3>
                <p className="text-sm text-muted">{slot.enrolled === false ? 'Not enrolled in this slot' : slot.inGroup ? slot.members?.map((member) => `${member.name} (${member.idNumber})`).join(', ') || 'Solo project' : 'No group'}</p>
                {slot.titles?.length ? <ul className="striped-list space-y-2">{slot.titles.map((title) => <li key={title.id} className="striped-row flex items-start justify-between gap-3 text-sm"><span>{title.text}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${title.status === 'verified' ? 'bg-sage/30 text-ok' : title.status === 'rejected' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>{title.status}</span></li>)}</ul> : <p className="text-sm text-muted">{slot.latestTitleText || 'No project yet'}</p>}
              </section>)}
            </div>
            <DialogFooter className="gap-2 sm:space-x-0">
              <button type="button" className="btn-secondary min-h-11" onClick={() => { onOpenStudent(selected); closeDetails(); }} disabled={!selected.memberships?.length}>Open on board</button>
              <Link className="btn-secondary min-h-11" href={`/dashboard/${classId}/students/${selected.id}`}>View profile</Link>
              <button type="button" className="btn-primary min-h-11" onClick={() => openEdit(selected)}>Edit student</button>
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
