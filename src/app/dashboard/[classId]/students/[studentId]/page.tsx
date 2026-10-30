'use client';
import { StudentPassword } from '@/components/dashboard/student-password';

import { ProfileTitleFeedback } from '@/components/dashboard/profile-title-feedback';
import { DashboardBreadcrumbs } from '@/components/dashboard/breadcrumbs';
import { ProfileGroupSetup } from '@/components/dashboard/profile-group-setup';
import { GroupTitleCreate } from '@/components/dashboard/group-title-create';
import { TitleEditor, type ProfTitle } from '@/components/dashboard/title-editor';
import { useQueryClient } from '@tanstack/react-query';
import { boardKeys } from '@/lib/query-keys';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Member = { id: string; name: string; idNumber?: string };
type Membership = {
  groupId: string;
  status: string;
  slotId: string;
  slotLabel: string;
  maxSize?: number;
  members: Member[];
};
type TitleRow = { id: string; text: string; status: string; groupId: string; slotId: string };
type LeaveRow = { id: string; status: string; reason: string | null; slotId: string };
type Student = {
  id: string;
  name: string;
  idNumber: string;
  password?: never;
  isActive: boolean;
  lastLoginAt: string | null;
};

export default function ProfessorStudentProfilePage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [feedbackTitle, setFeedbackTitle] = useState<TitleRow | null>(null);
  const [groupSetup, setGroupSetup] = useState<{ slotId?: string } | null>(null);
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<ProfTitle | null>(null);
  const [loadingTitleId, setLoadingTitleId] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<{ member: Member; group: Membership } | null>(null);
  const [removing, setRemoving] = useState(false);

  async function removeGroupMember() {
    if (!removingMember || removing) return;
    const { member, group } = removingMember;
    setRemoving(true);
    try {
      const res = await fetch(`/api/classes/${classId}/students/${member.id}/group`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.groupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove member');
      setRemovingMember(null);
      setGroupSetup(null);
      toast.success(`${member.name} removed from the group`);
      await queryClient.invalidateQueries({ queryKey: boardKeys.slot(classId, group.slotId) });
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not remove member'); }
    finally { setRemoving(false); }
  }

  async function openTitleEditor(titleId: string) {
    setLoadingTitleId(titleId);
    try {
      const response = await fetch(`/api/dashboard/titles/${titleId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load title');
      setEditingTitle(data.title);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not load title'); }
    finally { setLoadingTitleId(null); }
  }

  function titleSaved(slotId?: string) {
    if (slotId) void queryClient.invalidateQueries({ queryKey: boardKeys.slot(classId, slotId) });
    void load();
  }
  const [student, setStudent] = useState<Student | null>(null);
  const [profileClass, setProfileClass] = useState<{ id: string; name: string } | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [unassignedSlotIds, setUnassignedSlotIds] = useState<string[]>([]);
  const [hasEligibleSlots, setHasEligibleSlots] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const memberQuery = memberSearch.trim().toLowerCase();
  const matchesMember = (member: Member) => !memberQuery || [member.name, member.idNumber || ''].some(value => value.toLowerCase().includes(memberQuery));
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editPassword, setEditPassword] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/classes/${classId}/students/${studentId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not load student');
      setLoading(false);
      return;
    }
    setStudent(data.student);
    setProfileClass(data.class ? { id: classId, name: data.class.name } : null);
    setMemberships(data.memberships || []);
    setUnassignedSlotIds(data.unassignedSlotIds || []);
    setHasEligibleSlots(data.hasEligibleSlots ?? true);
    setTitles(data.titles || []);
    setLeaveRequests(data.leaveRequests || []);
    setEditName(data.student.name);
    setEditIdNumber(data.student.idNumber);
    setEditPassword('');
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, studentId]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy');
    }
  }

  function openOnBoard() {
    const first = memberships[0];
    const qs = new URLSearchParams({ tab: 'board', highlight: studentId });
    if (first?.slotId) qs.set('slot', first.slotId);
    router.push(`/dashboard/${classId}?${qs.toString()}`);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/classes/${classId}/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, idNumber: editIdNumber, ...(editPassword ? { password: editPassword } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Could not save');
      return;
    }
    setEditing(false);
    toast.success('Student updated');
    load();
  }

  async function removeStudent() {
    if (!student) return;
    if (!confirm(`Delete ${student.name} from this class?`)) return;
    const res = await fetch(`/api/classes/${classId}/students/${studentId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Could not delete');
      return;
    }
    toast.success('Student deleted');
    router.push(`/dashboard/${classId}?tab=roster`);
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <DashboardBreadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: profileClass?.id === classId ? profileClass.name : 'Class', href: `/dashboard/${classId}?tab=board` },
        { label: 'Roster / Students', href: `/dashboard/${classId}?tab=roster` },
        { label: student?.name || 'Student profile' },
      ]} />
      <div className="flex items-start justify-between gap-3">
        <div>
          {student && (
            <>
              <h1 className="text-2xl font-semibold mt-1">{student.name}</h1>
              <p className="text-sm text-muted mt-1">
                ID {student.idNumber}
                {' · '}
                {student.lastLoginAt ? `Last login ${new Date(student.lastLoginAt).toLocaleString()}` : 'Never logged in'}
                {student.isActive === false ? ' · Inactive' : ''}
              </p>
            </>
          )}
        </div>
        <ThemeToggle />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading profile…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : student ? (
        <>
          <section className="card space-y-3">
            <h2 className="font-medium">Credentials</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">ID</span>
              <span className="font-mono">{student.idNumber}</span>
              <button type="button" className="btn-secondary" onClick={() => copy(student.idNumber, 'ID')}>
                Copy
              </button>
            </div>
            <StudentPassword key={studentId} classId={classId} studentId={studentId} />
          </section>

          {groupSetup && <ProfileGroupSetup key={groupSetup.slotId || 'new'} classId={classId} studentId={studentId} initialSlotId={groupSetup.slotId} onClose={() => setGroupSetup(null)} onSaved={(slotId) => { toast.success('Group saved. You can now add or edit its project title.'); titleSaved(slotId); }} />}

          <section className="card space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="font-medium">Groups</h2>{hasEligibleSlots && (memberships.length === 0 || unassignedSlotIds.length > 0) && <button type="button" className="btn-primary" onClick={() => setGroupSetup({ slotId: unassignedSlotIds[0] })}>{memberships.length ? 'Set up another slot' : 'Set up group'}</button>}</div>
            {memberships.length > 0 && <div>
              <label className="label" htmlFor="group-member-search">Search group members</label>
              <input id="group-member-search" type="search" className="input" placeholder="Search by name or student ID" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} />
            </div>}
            {memberships.length === 0 ? (
              <p className="text-sm text-muted">{hasEligibleSlots ? 'Not in a group yet.' : 'Not enrolled in a project slot. Update enrollment under the slot’s Rules.'}</p>
            ) : (
              <div className="striped-list space-y-3">
                {memberships.filter(m => m.members.some(matchesMember)).map((m) => (
                  <div className="striped-row" key={`${m.slotId}-${m.groupId}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{m.slotLabel}</p>
                      {(m.maxSize !== undefined ? m.members.length < m.maxSize : m.status !== 'locked') && <button type="button" className="btn-secondary" onClick={() => setGroupSetup({ slotId: m.slotId })}>Add groupmates</button>}
                      <button type="button" className="btn-secondary" onClick={() => setAddingGroupId(m.groupId)} aria-label={`Add title for ${m.slotLabel}`}>Add title for group</button>
                    </div>
                    <p className="text-sm text-muted">{m.status}{m.maxSize !== undefined ? ` · ${m.members.length}/${m.maxSize} members${m.members.length >= m.maxSize ? ' · Group full' : ''}` : ''}</p>
                    <ul className="mt-2 space-y-2">
                      {m.members.filter(matchesMember).map((mem) => (
                        <li key={mem.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>{mem.name}{mem.idNumber ? <span className="text-muted"> · {mem.idNumber}</span> : null}</span>
                          <button type="button" className="btn-danger" onClick={() => setRemovingMember({ member: mem, group: m })} aria-label={`Remove ${mem.name} from ${m.slotLabel}`}>Remove</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {!memberships.some(m => m.members.some(matchesMember)) && <p className="text-sm text-muted" role="status">No members match your search.</p>}
              </div>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="font-medium">Titles</h2>
            {titles.length === 0 ? (
              <p className="text-sm text-muted">No titles linked to this student’s groups.</p>
            ) : (
              <ul className="striped-list space-y-2">
                {titles.map((t) => (
                  <li key={t.id} className="striped-row flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words">{t.text}</p>
                      <p className="text-xs text-muted mt-1">{memberships.find((m) => m.groupId === t.groupId)?.slotLabel} · {t.status}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setFeedbackTitle(t)} aria-label={`Feedback for ${t.text}`}>Feedback</button>
                    <button type="button" className="btn-secondary shrink-0" disabled={!!loadingTitleId} onClick={() => openTitleEditor(t.id)} aria-label={`Edit title: ${t.text}`}>{loadingTitleId === t.id ? 'Loading…' : 'Edit title'}</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {leaveRequests.length > 0 && (
            <section className="card striped-list space-y-2">
              <h2 className="font-medium">Leave requests</h2>
              {leaveRequests.map((req) => (
                <p key={req.id} className="striped-row text-sm text-muted">
                  {req.status}
                  {req.reason ? ` · ${req.reason}` : ''}
                </p>
              ))}
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
              Edit details
            </button>
            <button type="button" className="btn-secondary" onClick={openOnBoard}>
              Open on board
            </button>
            <button type="button" className="btn-danger" onClick={removeStudent}>
              Delete
            </button>
          </div>
        </>
      ) : null}

      {feedbackTitle && <ProfileTitleFeedback titleId={feedbackTitle.id} titleText={feedbackTitle.text} onClose={() => setFeedbackTitle(null)} />}
      {addingGroupId && <GroupTitleCreate key={addingGroupId} classId={classId} groups={memberships} initialGroupId={addingGroupId} onClose={() => setAddingGroupId(null)} onSaved={titleSaved} />}
      {editingTitle && <TitleEditor key={editingTitle.id} title={editingTitle} open onOpenChange={(open) => !open && setEditingTitle(null)} onSaved={() => titleSaved(editingTitle.slotId)} />}

      <Dialog open={!!removingMember} onOpenChange={(open) => { if (!open && !removing) setRemovingMember(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove group member?</DialogTitle>
            <DialogDescription>
              Remove {removingMember?.member.name} from the group for {removingMember?.group.slotLabel}? This takes effect immediately, like approving a leave request. The student stays enrolled in the class.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            {removingMember?.group.members.length === 1
              ? 'This is the last member. Under the current leave rules, the empty group and its project titles, tasks, and related records will be deleted.'
              : 'The remaining members keep the group and its projects. The removed student can create or join another group for this slot.'}
          </p>
          <DialogFooter>
            <button type="button" className="btn-secondary" disabled={removing} onClick={() => setRemovingMember(null)}>Cancel</button>
            <button type="button" className="btn-danger" disabled={removing} onClick={removeGroupMember}>{removing ? 'Removing…' : 'Remove member'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form onSubmit={saveEdit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit student</DialogTitle>
              <DialogDescription>Update name, ID number, or password.</DialogDescription>
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
              <input className="input" type="password" minLength={12} placeholder="Leave blank to keep current password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>
            <DialogFooter>
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
