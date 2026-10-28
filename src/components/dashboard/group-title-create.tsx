'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { titleRequest } from '@/lib/title-request';
import { TechStackInput } from '@/components/student/tech-stack-input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type GroupChoice = { groupId: string; slotId: string; slotLabel: string; members: { id: string; name: string }[] };

export function GroupTitleCreate({ classId, groups, initialGroupId, onClose, onSaved }: {
  classId: string; groups: GroupChoice[]; initialGroupId: string;
  onClose: () => void; onSaved: (slotId: string) => void;
}) {
  const [groupId, setGroupId] = useState(initialGroupId);
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [targetUsers, setTargetUsers] = useState('');
  const [autoVerify, setAutoVerify] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const group = groups.find((item) => item.groupId === groupId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!group || saving || text.trim().length < 5 || !description.trim()) return;
    setSaving(true); setError('');
    try {
      const response = await titleRequest('/api/dashboard/titles', 'POST', {
        classId, groupId: group.groupId, text, description, techStack, targetUsers, autoVerify,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not add title');
      toast.success(autoVerify ? 'Title added and approved' : 'Title added for the group');
      onSaved(group.slotId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add title');
    } finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-w-xl w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto rounded-3xl">
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader><DialogTitle>Add title for group</DialogTitle><DialogDescription>This project belongs to the whole group and will appear for all its members.</DialogDescription></DialogHeader>
        <div>
          <label htmlFor="assigned-group" className="label">Project slot and group</label>
          <select id="assigned-group" className="input" value={groupId} disabled={saving} onChange={(event) => setGroupId(event.target.value)}>
            {groups.map((item) => <option key={item.groupId} value={item.groupId}>{item.slotLabel} — {item.members.map((member) => member.name).join(', ') || 'Group'}</option>)}
          </select>
        </div>
        <div><label htmlFor="assigned-title" className="label">Title</label><input id="assigned-title" className="input" required minLength={5} value={text} disabled={saving} onChange={(event) => setText(event.target.value)} /></div>
        <div><label htmlFor="assigned-description" className="label">Description</label><textarea id="assigned-description" className="input min-h-24" required value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} /></div>
        <div><p className="label">Tech stack (optional)</p><TechStackInput value={techStack} onChange={setTechStack} suggestionsUrl={group ? `/api/prof/slots/${group.slotId}/tech-tags` : undefined} /></div>
        <div><label htmlFor="assigned-users" className="label">Target users (optional)</label><input id="assigned-users" className="input" value={targetUsers} disabled={saving} onChange={(event) => setTargetUsers(event.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoVerify} disabled={saving} onChange={(event) => setAutoVerify(event.target.checked)} />Approve this title immediately</label>
        <p className="text-xs text-muted">Otherwise, it stays pending for review. Project progress starts in Planning.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <DialogFooter className="gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={saving || !group || text.trim().length < 5 || !description.trim()}>{saving ? 'Adding…' : 'Add title'}</button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
