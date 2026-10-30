'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Eye, Pencil, X } from 'lucide-react';
import { MarkdownView } from '@/components/ui/markdown-view';
import { TechStackInput } from '@/components/student/tech-stack-input';
import { normalizeTechStack } from '@/lib/tech-stack';
import { SlotParticipants, type SlotParticipant } from '@/components/dashboard/slot-participants';

export type SlotRules = {
  groupSize: number;
  titlesRequiredMin: number;
  titlesAllowedMax: number;
  duplicateCheck: 'strict' | 'warn';
  requireTechStack: boolean;
  defaultTechStack: string[];
  excludedStudentIds?: string[];
  requireTargetUsers: boolean;
  requireDeploymentUrl: boolean;
  deadline: string | null;
  locked: boolean;
  instructions?: string | null;
};

export const DEFAULT_SLOT_RULES: SlotRules = {
  groupSize: 1,
  titlesRequiredMin: 2,
  titlesAllowedMax: 50,
  duplicateCheck: 'warn',
  requireTechStack: true,
  defaultTechStack: [],
  excludedStudentIds: [],
  requireTargetUsers: false,
  requireDeploymentUrl: false,
  deadline: null,
  locked: false,
  instructions: null,
};

export function defaultsKey(classId: string) {
  return `ps-slot-defaults:${classId}`;
}
export function loadClassDefaults(classId: string): SlotRules {
  try {
    const raw = localStorage.getItem(defaultsKey(classId));
    if (!raw) return DEFAULT_SLOT_RULES;
    const stored = JSON.parse(raw);
    return { ...DEFAULT_SLOT_RULES, ...stored, defaultTechStack: normalizeTechStack(stored.defaultTechStack), excludedStudentIds: [] };
  } catch {
    return DEFAULT_SLOT_RULES;
  }
}

export function saveClassDefaults(classId: string, rules: SlotRules) {
  const { excludedStudentIds: _excluded, ...defaults } = rules;
  localStorage.setItem(defaultsKey(classId), JSON.stringify(defaults));
}

function datetimeLocal(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SlotInstructionsField({
  instructions,
  onChange,
  onSaveDirect,
}: {
  instructions: string | null | undefined;
  onChange: (val: string | null) => void;
  onSaveDirect?: (val: string | null) => Promise<void> | void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(instructions || '');
  const [baseline, setBaseline] = useState(instructions || '');
  const [saving, setSaving] = useState(false);

  // Sync baseline and draft when instructions prop updates from outside while not editing
  useEffect(() => {
    if (!isEditing) {
      setDraft(instructions || '');
      setBaseline(instructions || '');
    }
  }, [instructions, isEditing]);

  const hasChanged = draft !== baseline;

  const handleEdit = () => {
    setDraft(baseline);
    setIsEditing(true);
  };

  const handleTogglePreview = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    const nextVal = draft.trim() || null;
    setBaseline(draft);
    onChange(nextVal);
    if (onSaveDirect) {
      setSaving(true);
      try {
        await onSaveDirect(nextVal);
        toast.success('Slot instructions saved');
      } catch {
        // error handled by caller
      } finally {
        setSaving(false);
      }
    } else {
      toast.success('Instructions saved');
    }
    setIsEditing(false);
  };

  const handleExit = () => {
    setDraft(baseline);
    onChange(baseline.trim() || null);
    setIsEditing(false);
    toast.info('Changes discarded');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setDraft(nextVal);
    onChange(nextVal.trim() || null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label mb-0">Slot Instructions (optional)</label>
        <div className="flex items-center gap-1.5">
          {!isEditing ? (
            <button
              type="button"
              className="btn-secondary h-7 px-2.5 text-xs flex items-center gap-1.5"
              onClick={handleEdit}
              title="Edit slot instructions"
            >
              <Pencil className="h-3.5 w-3.5 text-muted" />
              Edit
            </button>
          ) : hasChanged ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={saving}
                className="btn-primary h-7 px-2.5 text-xs flex items-center gap-1 shadow-sm"
                onClick={handleSave}
                title="Save changes and view preview"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                disabled={saving}
                className="btn-secondary h-7 px-2.5 text-xs flex items-center gap-1 text-muted-foreground hover:text-danger hover:border-danger/30"
                onClick={handleExit}
                title="Discard changes and exit"
              >
                <X className="h-3.5 w-3.5" />
                Exit
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary h-7 px-2.5 text-xs flex items-center gap-1.5"
              onClick={handleTogglePreview}
              title="Toggle back to preview"
            >
              <Eye className="h-3.5 w-3.5 text-muted" />
              Preview
            </button>
          )}
        </div>
      </div>

      {!isEditing ? (
        <div
          onClick={handleEdit}
          title="Click to edit instructions"
          className="rounded-xl border border-line bg-background/50 p-3 min-h-[85px] cursor-pointer hover:border-primary/40 transition-colors"
        >
          <MarkdownView
            content={instructions}
            placeholder="No instructions provided yet. Click 'Edit' to write guidelines in Markdown (headings, lists, code, links)."
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <textarea
            className="input min-h-[110px] font-mono text-sm leading-relaxed"
            placeholder="Provide special instructions or guidelines for students in this project slot… (Markdown supported)"
            value={draft}
            onChange={handleInputChange}
            autoFocus
          />
          <div className="flex items-center justify-between text-[11px] text-muted px-1">
            <span>Markdown supported: **bold**, *italic*, # heading, - list, `code`, [link](url)</span>
            {hasChanged && (
              <span className="font-medium text-warn flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
                Unsaved edits
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SlotRulesFields({
  rules,
  onChange,
  includeLock,
  onSaveInstructions,
  students,
}: {
  rules: SlotRules;
  onChange: (next: SlotRules) => void;
  includeLock?: boolean;
  onSaveInstructions?: (val: string | null) => Promise<void> | void;
  students?: SlotParticipant[];
}) {
  function set<K extends keyof SlotRules>(key: K, value: SlotRules[K]) {
    onChange({ ...rules, [key]: value });
  }

  return (
    <div className="space-y-3">
      {students && <SlotParticipants students={students} excludedIds={rules.excludedStudentIds || []} onChange={ids => set('excludedStudentIds', ids)} />}
      <SlotInstructionsField
        instructions={rules.instructions}
        onChange={(val) => set('instructions', val)}
        onSaveDirect={onSaveInstructions}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Group size (1 = solo)</label>
          <input
            type="number"
            min={1}
            className="input"
            value={rules.groupSize}
            onChange={(e) => set('groupSize', Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="label">Duplicate check</label>
          <select
            className="input"
            value={rules.duplicateCheck}
            onChange={(e) => set('duplicateCheck', e.target.value as 'strict' | 'warn')}
          >
            <option value="warn">Warn only</option>
            <option value="strict">Block on match</option>
          </select>
          <p className="text-xs text-muted mt-1">Checks titles in the same class and project slot. Warn only requires confirmation; Block on match prevents submission when similar wording is found.</p>
        </div>
        <div>
          <label className="label">Titles min</label>
          <input
            type="number"
            min={0}
            className="input"
            value={rules.titlesRequiredMin}
            onChange={(e) => set('titlesRequiredMin', Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <label className="label">Titles max</label>
          <input
            type="number"
            min={1}
            className="input"
            value={rules.titlesAllowedMax}
            onChange={(e) => set('titlesAllowedMax', Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>
      <div>
        <label className="label">Deadline (optional)</label>
        <input
          type="datetime-local"
          className="input"
          value={datetimeLocal(rules.deadline)}
          onChange={(e) => set('deadline', e.target.value ? new Date(e.target.value).toISOString() : null)}
        />
      </div>
      <section aria-label="Default tech stack" className="space-y-2">
        <p className="label">Default tech stack</p>
        <TechStackInput value={rules.defaultTechStack || []} onChange={tags => set('defaultTechStack', tags)} />
        <p className="text-xs text-muted">Added automatically when students start a new project in this slot. Students can remove or replace these tags. Existing projects keep their saved tags.</p>
      </section>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rules.requireTechStack}
            onChange={(e) => set('requireTechStack', e.target.checked)}
          />
          Require tech stack
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rules.requireTargetUsers}
            onChange={(e) => set('requireTargetUsers', e.target.checked)}
          />
          Require target users
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={rules.requireDeploymentUrl}
            onChange={(e) => set('requireDeploymentUrl', e.target.checked)}
          />
          Require deployment URL
        </label>
        {includeLock && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={rules.locked} onChange={(e) => set('locked', e.target.checked)} />
            Lock this slot (students cannot submit)
          </label>
        )}
      </div>
    </div>
  );
}
export function SlotSettingsPanel({
  classId,
  slotId,
  initial,
  onSaved,
  students,
}: {
  classId: string;
  slotId: string;
  initial: SlotRules;
  onSaved: () => void;
  students?: SlotParticipant[];
}) {
  const [rules, setRules] = useState<SlotRules>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${classId}/slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save settings');
      toast.success('Slot rules saved');
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function saveInstructionsDirect(instructions: string | null) {
    const res = await fetch(`/api/classes/${classId}/slots/${slotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save instructions');
    onSaved();
  }

  return (
    <div className="border-t border-line pt-3 space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-2">Slot Rules & Constraints</h3>
        <SlotRulesFields
          rules={rules}
          onChange={setRules}
          includeLock
          onSaveInstructions={saveInstructionsDirect}
          students={students}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save rules'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              saveClassDefaults(classId, rules);
              toast.success('These rules will be used for new slots in this class');
            }}
          >
            Use as class defaults
          </button>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <DocFieldsManager slotId={slotId} />
      </div>
    </div>
  );
}

export type DocFieldTemplate = {
  id: string;
  slotId: string;
  fieldKey: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'url' | 'date';
  required: boolean;
  sortOrder: number;
  createdAt: string;
};

export function DocFieldsManager({ slotId }: { slotId: string }) {
  const [fields, setFields] = useState<DocFieldTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState<'text' | 'textarea' | 'url' | 'date'>('textarea');
  const [newRequired, setNewRequired] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadFields = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prof/slots/${slotId}/doc-fields`);
      if (res.ok) {
        const data = await res.json();
        setFields(data.fields || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    loadFields();
  });

  async function addField(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/prof/slots/${slotId}/doc-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          fieldKey: newKey.trim() || undefined,
          fieldType: newType,
          required: newRequired,
          sortOrder: fields.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add field');
      toast.success('Documentation field added');
      setNewLabel('');
      setNewKey('');
      setNewType('textarea');
      setNewRequired(false);
      await loadFields();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not add field');
    } finally {
      setAdding(false);
    }
  }

  async function deleteField(id: string) {
    try {
      const res = await fetch(`/api/prof/slots/${slotId}/doc-fields/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete field');
      toast.success('Field removed');
      setFields((prev) => prev.filter((f) => f.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not delete field');
    }
  }

  async function toggleRequired(f: DocFieldTemplate) {
    try {
      const res = await fetch(`/api/prof/slots/${slotId}/doc-fields/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required: !f.required }),
      });
      if (res.ok) {
        setFields((prev) => prev.map((x) => (x.id === f.id ? { ...x, required: !x.required } : x)));
        toast.success(`"${f.label}" is now ${!f.required ? 'required' : 'optional'}`);
      }
    } catch {
      toast.error('Could not update field');
    }
  }

  async function seedStandardFields() {
    setSeeding(true);
    const standard = [
      { label: 'Description / Abstract', fieldKey: 'abstract', fieldType: 'textarea', required: true, sortOrder: 0 },
      { label: 'Statement of the Problem', fieldKey: 'statement_of_problem', fieldType: 'textarea', required: true, sortOrder: 1 },
      { label: 'Scope & Limitations', fieldKey: 'scope_and_limitations', fieldType: 'textarea', required: false, sortOrder: 2 },
      { label: 'Key Objectives', fieldKey: 'key_objectives', fieldType: 'textarea', required: true, sortOrder: 3 },
    ];

    try {
      for (const item of standard) {
        if (!fields.some((f) => f.fieldKey === item.fieldKey)) {
          await fetch(`/api/prof/slots/${slotId}/doc-fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
        }
      }
      toast.success('Standard academic documentation fields seeded');
      await loadFields();
    } catch {
      toast.error('Could not seed documentation fields');
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Custom Documentation Fields</h3>
          <p className="text-xs text-muted">
            Description / Abstract uses the same overview as Submissions. Add other documentation fields such as Objectives or Methodology.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs py-1"
          onClick={seedStandardFields}
          disabled={seeding}
        >
          {seeding ? 'Seeding…' : 'Seed standard academic fields'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Loading documentation fields…</p>
      ) : fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-4 text-center">
          <p className="text-xs text-muted">No custom documentation fields configured for this slot.</p>
          <p className="text-[11px] text-muted mt-1">Students will submit standard summary and changelog.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-line bg-secondary/30 text-xs"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{f.fieldKey === 'abstract' ? 'Description / Abstract' : f.label}</p>
                <p className="text-muted font-mono text-[10px]">
                  key: {f.fieldKey} · type: {f.fieldType}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={() => toggleRequired(f)}
                  />
                  <span className={f.required ? 'font-medium text-warn' : 'text-muted'}>
                    Required
                  </span>
                </label>
                <button
                  type="button"
                  className="text-danger hover:underline ml-2"
                  onClick={() => deleteField(f.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addField} className="rounded-lg border border-line p-3 bg-secondary/15 space-y-3">
        <h4 className="text-xs font-semibold text-ink">Add New Documentation Field</h4>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <label className="label text-[11px]">Field Label</label>
            <input
              className="input text-xs py-1"
              required
              placeholder="e.g. Methodology"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-[11px]">Field Key (optional slug)</label>
            <input
              className="input text-xs py-1"
              placeholder="e.g. methodology"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <label className="label text-[11px]">Input Type</label>
            <select
              className="input text-xs py-1"
              value={newType}
              onChange={(e) => setNewType(e.target.value as typeof newType)}
            >
              <option value="textarea">Long Text (Textarea)</option>
              <option value="text">Single Line (Text)</option>
              <option value="url">Web Link (URL)</option>
              <option value="date">Date</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 pt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={newRequired}
              onChange={(e) => setNewRequired(e.target.checked)}
            />
            Required deliverable
          </label>
          <div className="pt-4 ml-auto">
            <button type="submit" className="btn-primary text-xs py-1" disabled={adding || !newLabel.trim()}>
              {adding ? 'Adding…' : '+ Add Field'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

