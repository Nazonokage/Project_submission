'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
  members?: { id: string; name: string; idNumber: string }[];
  titles?: { id: string; text: string; status: string }[];
};

export type RosterStudent = {
  slotProgress?: SlotProgress[];
  id: string;
  name: string;
  idNumber: string;
  password: string;
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
}: {
  classId: string;
  students: RosterStudent[];
  defaultStudentPassword: string;
  onChange: () => void;
  onOpenStudent: (student: RosterStudent) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showPasswords, setShowPasswords] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = students.find((student) => student.id === selectedId) || null;
  const rowTrigger = useRef<HTMLTableRowElement | null>(null);
  function closeDetails() {
    setSelectedId(null);
    setEditing(null);
    setError(null);
    setShowPasswords(false);
  }
  const filteredStudents = students.filter((s) => {
    const matches = `${s.name} ${s.idNumber}`.toLowerCase().includes(search.trim().toLowerCase());
    const progress = s.slotProgress || [];
    return matches && (filter === 'all' ||
      (filter === 'no-group' && !s.memberships?.length) ||
      (filter === 'never' && !s.lastLoginAt) ||
      (filter === 'pending' && progress.some((p) => p.pendingCount > 0)) ||
      (filter === 'verified' && progress.some((p) => p.verifiedCount > 0)));
  });
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [name, setName] = useState('');
  const [classPassword, setClassPassword] = useState(defaultStudentPassword);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RosterStudent | null>(null);
  const [editName, setEditName] = useState('');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setClassPassword(defaultStudentPassword);
  }, [defaultStudentPassword]);

  async function saveClassPassword(e: React.FormEvent) {
    e.preventDefault();
    const value = classPassword.trim();
    if (!value) {
      setError('Class default password cannot be empty');
      return;
    }
    setSavingPassword(true);
    setError(null);
    const res = await fetch(`/api/classes/${classId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultStudentPassword: value }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingPassword(false);
    if (!res.ok) {
      setError(data.error || 'Could not save default password');
      return;
    }
    toast.success('Class default password saved');
    onChange();
  }

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
    toast.success(`Imported ${data.count} students`);
    onChange();
  }

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/classes/${classId}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setName('');
    toast.success(`Added ${data.student?.name} as ${data.student?.idNumber}`);
    onChange();
  }

  function openEdit(student: RosterStudent) {
    setError(null);
    setEditing(student);
    setEditName(student.name);
    setEditIdNumber(student.idNumber);
    setEditPassword(student.password);
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
        password: editPassword,
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
      <details className="rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium touch-manipulation">Manage roster</summary>
        <div className="mt-4 space-y-4">
      <form onSubmit={saveClassPassword} className="card space-y-2">
        <label className="label">Class default password</label>
        <div className="flex flex-wrap items-end gap-3">
          <input
            className="input max-w-xs"
            value={classPassword}
            onChange={(e) => setClassPassword(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={savingPassword}>
            {savingPassword ? 'Saving…' : 'Save'}
          </button>
        </div>
        <p className="text-sm text-muted">
          New and imported students get this password. Edit a student to override.
        </p>
      </form>

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
          <p className="text-sm text-muted">IDs continue from the current roster. Password = class default.</p>
          <button type="submit" className="btn-primary">
            Import students
          </button>
        </form>
      )}
      <form onSubmit={addOne} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]">
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary">
          Add student
        </button>
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

      </div>
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
                    <span className="inline-flex items-center gap-2"><span className="underline decoration-dotted underline-offset-4">{student.name}</span><ChevronRight aria-hidden="true" className="row-chevron h-4 w-4 shrink-0" /></span>{student.isActive === false && <span className="block text-xs font-normal text-muted">Inactive</span>}
                  </th>
                  <td className="px-5 py-4 font-mono tabular-nums whitespace-nowrap">{student.idNumber}</td>
                  <td className="px-5 py-4 min-w-[13rem]">
                    {(student.slotProgress || []).filter((slot) => slot.inGroup).map((slot) => (
                      <div key={slot.slotId} className="mb-2 last:mb-0">
                        <p className="text-xs text-muted mb-1">{slot.slotLabel}</p>
                        <p>{slot.members?.filter((member) => member.id !== student.id).map((member) => `${member.name} (${member.idNumber})`).join(', ') || 'Solo project'}</p>
                      </div>
                    ))}
                    {!student.slotProgress?.some((slot) => slot.inGroup) && <span className="text-muted">No group</span>}
                  </td>
                  <td className="px-5 py-4 min-w-[15rem]">
                    {(student.slotProgress || []).map((slot) => (
                      <div key={slot.slotId} className="mb-2 last:mb-0">
                        <p className="text-xs text-muted mb-1">{slot.slotLabel}</p>
                        {slot.titles?.length ? slot.titles.map((title) => <p key={title.id} className="leading-relaxed">{title.text}</p>) : <p className="text-muted">{slot.latestTitleText || 'No project yet'}</p>}
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
              <input id="roster-edit-password" className="input" required value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
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
              <DialogTitle className="text-2xl tracking-tight leading-tight">{selected.name}</DialogTitle>
              <DialogDescription>Student details · <span className="font-mono">{selected.idNumber}</span></DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl bg-secondary/40 p-4 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted">Password</span>
                <span className="font-mono">{showPasswords ? selected.password : '••••••'}</span>
                <button type="button" className="ml-auto text-accent min-h-11 px-2 rounded-lg focus-visible:ring-2 focus-visible:ring-accent" onClick={() => setShowPasswords(!showPasswords)}>{showPasswords ? 'Hide password' : 'Show password'}</button>
              </div>
              <p className="text-muted">{selected.lastLoginAt ? `Last login ${new Date(selected.lastLoginAt).toLocaleString()}` : 'Never logged in'}</p>
              {selected.isActive === false && <p className="text-danger">Inactive student</p>}
            </div>
            <div className="space-y-4">
              {(selected.slotProgress || []).map((slot) => <section key={slot.slotId} className="rounded-2xl border border-line p-4 space-y-2">
                <h3 className="font-semibold text-sm">{slot.slotLabel}</h3>
                <p className="text-sm text-muted">{slot.inGroup ? slot.members?.map((member) => `${member.name} (${member.idNumber})`).join(', ') || 'Solo project' : 'No group'}</p>
                {slot.titles?.length ? <ul className="space-y-2">{slot.titles.map((title) => <li key={title.id} className="flex items-start justify-between gap-3 text-sm"><span>{title.text}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${title.status === 'verified' ? 'bg-sage/30 text-ok' : title.status === 'rejected' ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-900'}`}>{title.status}</span></li>)}</ul> : <p className="text-sm text-muted">{slot.latestTitleText || 'No project yet'}</p>}
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
