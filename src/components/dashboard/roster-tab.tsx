'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type RosterStudent = {
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
      {error && <p className="text-sm text-danger">{error}</p>}
      {students.length === 0 ? (
        <p className="text-sm text-muted">No students yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Password</th>
                <th className="py-2 pr-4">Info</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 align-top">
                  <td className="py-2 pr-4 font-medium">{s.name}</td>
                  <td className="py-2 pr-4 font-mono">{s.idNumber}</td>
                  <td className="py-2 pr-4 font-mono">{s.password}</td>
                  <td className="py-2 pr-4 text-muted">
                    <div>{(s.memberships?.length ?? 0) > 0 ? 'In group' : 'No group'}</div>
                    <div>{s.lastLoginAt ? `Last login ${new Date(s.lastLoginAt).toLocaleString()}` : 'Never logged in'}</div>
                    {s.isActive === false && <div className="text-danger">Inactive</div>}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                      <Link className="btn-secondary" href={`/dashboard/${classId}/students/${s.id}`}>
                        View profile
                      </Link>
                      <button type="button" className="btn-secondary" onClick={() => onOpenStudent(s)}>
                        Open on board
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <form onSubmit={saveEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit student</DialogTitle>
              <DialogDescription>Save sends a single update. Cancel discards changes.</DialogDescription>
            </DialogHeader>
            <div>
              <label className="label">Name</label>
              <input className="input" required value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="label">ID number</label>
              <input className="input" required value={editIdNumber} onChange={(e) => setEditIdNumber(e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" required value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>
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
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
