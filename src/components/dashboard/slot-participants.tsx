'use client';
import { useId, useState } from 'react';

export type SlotParticipant = { id: string; name: string; idNumber: string };

export function SlotParticipants({ students, excludedIds, onChange }: {
  students: SlotParticipant[]; excludedIds: string[]; onChange: (ids: string[]) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = students.filter(student => [student.name, student.idNumber].some(value => value.toLowerCase().includes(query)));
  const includedCount = students.filter(student => !excludedIds.includes(student.id)).length;
  return <section aria-label="Students taking this slot" className="rounded-xl border border-line p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Students taking this slot</h4>
      <span className="text-sm text-muted" role="status">{includedCount} of {students.length} students included</span>
    </div>
    <p className="text-xs text-muted">Uncheck students who do not take this subject. They stay on the class roster and in their other slots. New roster additions are included by default.</p>
    <label htmlFor={id} className="label">Search students for this slot</label>
    <input id={id} type="search" className="input" placeholder="Search name or student ID" value={search} onChange={event => setSearch(event.target.value)} />
    <button type="button" className="btn-secondary" disabled={includedCount === students.length} onClick={() => onChange([])}>Include all students</button>
    <div className="max-h-64 overflow-auto space-y-2">
      {visible.map(student => <label key={student.id} className="flex items-center gap-3 rounded-lg border border-line p-3 text-sm">
        <input type="checkbox" checked={!excludedIds.includes(student.id)} onChange={event => onChange(event.target.checked ? excludedIds.filter(value => value !== student.id) : [...new Set([...excludedIds, student.id])])} />
        <span>{student.name} <span className="text-muted">· {student.idNumber}</span></span>
      </label>)}
      {!students.length && <p className="text-sm text-muted">No students yet. Students added to the roster later will be included.</p>}
      {students.length > 0 && !visible.length && <p className="text-sm text-muted">No students match your search.</p>}
    </div>
  </section>;
}
