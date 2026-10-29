'use client';
import { useEffect, useRef, useState } from 'react';

type Slot = { id: string; label: string; groupSize: number; excludedStudentIds?: string[] };
type Student = { id: string; name: string; idNumber: string; memberships?: { groupId: string; slotId: string }[] };
export function ProfileGroupSetup({ classId, studentId, initialSlotId, onClose, onSaved }: {
  classId: string; studentId: string; initialSlotId?: string; onClose: () => void; onSaved: (slotId: string, groupId: string) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: 'nearest' }); }, []);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [slotId, setSlotId] = useState(initialSlotId || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const responses = await Promise.all([fetch(`/api/classes/${classId}/slots`, { signal: controller.signal }), fetch(`/api/classes/${classId}/students`, { signal: controller.signal })]);
        if (responses.some(response => !response.ok)) throw new Error('Could not load classmates and project slots. Close and try again.');
        const [slotData, studentData] = await Promise.all(responses.map(response => response.json()));
        const eligible = (slotData.slots || []).filter((slot: Slot) => !slot.excludedStudentIds?.includes(studentId));
        setSlots(eligible); setStudents(studentData.students || []);
        setSlotId(eligible.some((slot: Slot) => slot.id === initialSlotId) ? initialSlotId! : eligible[0]?.id || '');
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load groups'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [classId, initialSlotId, studentId]);
  const slot = slots.find(item => item.id === slotId);
  const current = students.find(item => item.id === studentId)?.memberships?.find(item => item.slotId === slotId);
  const members = current ? students.filter(item => item.memberships?.some(m => m.groupId === current.groupId && m.slotId === slotId)) : students.filter(item => item.id === studentId);
  const available = students.filter(item => item.id !== studentId && !slot?.excludedStudentIds?.includes(item.id) && !item.memberships?.some(m => m.slotId === slotId));
  const query = search.trim().toLowerCase();
  const filteredAvailable = available.filter(item => [item.name, item.idNumber].some(value => value.toLowerCase().includes(query)));
  const full = members.length + selected.length >= (slot?.groupSize || 1);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!slot || saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/classes/${classId}/students/${studentId}/group`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slotId, memberIds: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save group');
      onSaved(slotId, data.groupId); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save group'); }
    finally { setSaving(false); }
  }
  return <section ref={panel} tabIndex={-1} aria-labelledby="group-setup-heading" className="card rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <form onSubmit={save} className="space-y-4">
      <header className="space-y-1"><h2 id="group-setup-heading" className="text-lg font-semibold">Set up project group</h2><p className="text-sm text-muted">Start solo, or choose available classmates. Existing members and project titles stay with their group.</p></header>
      {loading ? <p>Loading classmates…</p> : <>
        <label className="label" htmlFor="profile-group-slot">Project slot</label>
        <select id="profile-group-slot" className="input" value={slotId} disabled={saving} onChange={event => { setSlotId(event.target.value); setSelected([]); setSearch(''); }}>
          {slots.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {!slots.length && <p className="text-sm text-muted">No available slots for this student. Check slot enrollment in class Settings.</p>}
        <div className="rounded-2xl bg-secondary/40 p-4 text-sm"><p className="font-medium">{current ? 'Current members' : 'Solo by default'}</p><p>{members.map(item => item.name).join(', ')}</p><p className="text-muted mt-1">{members.length + selected.length} / {slot?.groupSize || 1} members</p></div>
        <fieldset disabled={saving} className="striped-list space-y-2"><legend className="text-sm font-medium mb-2">Add groupmates (optional)</legend>
          <label className="label" htmlFor="available-classmate-search">Search available classmates</label>
          <input id="available-classmate-search" type="search" className="input" placeholder="Search by name or student ID" value={search} onChange={event => setSearch(event.target.value)} />
          {filteredAvailable.map(item => <label key={item.id} className="striped-row flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={selected.includes(item.id)} disabled={full && !selected.includes(item.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} />{item.name} · {item.idNumber}</label>)}
          {!available.length && <p className="text-sm text-muted">No unassigned classmates in this slot.</p>}
          {available.length > 0 && !filteredAvailable.length && <p className="text-sm text-muted" role="status">No classmates match your search.</p>}
        </fieldset>
        <p className="text-xs text-muted">Students already assigned to another group are not moved. Slot size limits still apply.</p>
      </>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={loading || saving || !slot || (current ? selected.length === 0 : !members.length)}>{saving ? 'Saving…' : current ? 'Save groupmates' : selected.length ? 'Create group' : 'Create solo group'}</button></div>
    </form>
  </section>;
}
