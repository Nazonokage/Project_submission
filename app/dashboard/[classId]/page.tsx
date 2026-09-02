'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Slot = {
  id: string;
  label: string;
  groupSize: number;
  titlesRequiredMin: number;
  titlesAllowedMax: number;
  duplicateCheck: 'strict' | 'warn';
  locked: boolean;
};

type Student = { id: string; name: string; idNumber: string; password: string };

export default function ClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const [tab, setTab] = useState<'slots' | 'roster'>('slots');
  const [cls, setCls] = useState<{ name: string; term: string } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [clsRes, slotsRes, studentsRes] = await Promise.all([
      fetch(`/api/classes/${classId}`),
      fetch(`/api/classes/${classId}/slots`),
      fetch(`/api/classes/${classId}/students`),
    ]);
    if (clsRes.ok) setCls((await clsRes.json()).class);
    if (slotsRes.ok) setSlots((await slotsRes.json()).slots);
    if (studentsRes.ok) setStudents((await studentsRes.json()).students);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const studentLoginLink =
    typeof window !== 'undefined' ? `${window.location.origin}/c/${classId}/login` : '';

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-muted hover:underline">
          ← All classes
        </Link>
        <h1 className="text-xl font-semibold mt-1">{cls?.name || '…'}</h1>
        <p className="text-sm text-muted">{cls?.term}</p>
      </div>

      <div className="card flex items-center justify-between text-sm">
        <div>
          <p className="font-medium">Student login link</p>
          <p className="text-muted">{studentLoginLink}</p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => navigator.clipboard.writeText(studentLoginLink)}
        >
          Copy
        </button>
      </div>

      <div className="flex gap-2 border-b border-line">
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 ${
            tab === 'slots' ? 'border-accent text-accent' : 'border-transparent text-muted'
          }`}
          onClick={() => setTab('slots')}
        >
          Project slots
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 ${
            tab === 'roster' ? 'border-accent text-accent' : 'border-transparent text-muted'
          }`}
          onClick={() => setTab('roster')}
        >
          Student roster ({students.length})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tab === 'slots' ? (
        <SlotsTab classId={classId} slots={slots} onChange={loadAll} />
      ) : (
        <RosterTab classId={classId} students={students} onChange={loadAll} />
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
  const [groupSize, setGroupSize] = useState(1);
  const [duplicateCheck, setDuplicateCheck] = useState<'strict' | 'warn'>('warn');
  const [error, setError] = useState<string | null>(null);

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/classes/${classId}/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, groupSize, duplicateCheck }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setLabel('');
    setGroupSize(1);
    setShowForm(false);
    onChange();
  }

  async function removeSlot(slotId: string) {
    if (!confirm('Delete this project slot? Groups and titles under it will be deleted too.')) return;
    await fetch(`/api/classes/${classId}/slots/${slotId}`, { method: 'DELETE' });
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Group size (1 = solo)</label>
              <input
                type="number"
                min={1}
                className="input"
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Duplicate title check</label>
              <select
                className="input"
                value={duplicateCheck}
                onChange={(e) => setDuplicateCheck(e.target.value as 'strict' | 'warn')}
              >
                <option value="warn">Warn only</option>
                <option value="strict">Block on match</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className="btn-primary">
            Create slot
          </button>
        </form>
      )}

      {slots.length === 0 ? (
        <p className="text-sm text-muted">No project slots yet.</p>
      ) : (
        <div className="grid gap-3">
          {slots.map((s) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{s.label}</p>
                <p className="text-sm text-muted">
                  {s.groupSize === 1 ? 'Solo' : `Groups of ${s.groupSize}`} · duplicate check:{' '}
                  {s.duplicateCheck}
                  {s.locked && ' · locked'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/dashboard/${classId}/${s.id}`} className="btn-secondary">
                  Verification queue
                </Link>
                <button className="btn-danger" onClick={() => removeSlot(s.id)}>
                  Delete
                </button>
              </div>
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
}: {
  classId: string;
  students: Student[];
  onChange: () => void;
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
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowImport((s) => !s)}>
            Import .txt
          </button>
        </div>
        <button className="btn-secondary" onClick={exportCsv} disabled={students.length === 0}>
          Export CSV
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
          <input
            className="input"
            required
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />
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
                <EditableRow key={s.id} student={s} onSave={updateField} />
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
}: {
  student: Student;
  onSave: (id: string, field: 'name' | 'idNumber' | 'password', value: string) => void;
}) {
  const [name, setName] = useState(student.name);
  const [idNumber, setIdNumber] = useState(student.idNumber);
  const [password, setPassword] = useState(student.password);

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-1.5 pr-4">
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
