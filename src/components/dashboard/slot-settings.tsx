'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export type SlotRules = {
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

export const DEFAULT_SLOT_RULES: SlotRules = {
  groupSize: 1,
  titlesRequiredMin: 2,
  titlesAllowedMax: 50,
  duplicateCheck: 'warn',
  requireTechStack: true,
  requireTargetUsers: false,
  requireDeploymentUrl: false,
  deadline: null,
  locked: false,
};

export function defaultsKey(classId: string) {
  return `ps-slot-defaults:${classId}`;
}

export function loadClassDefaults(classId: string): SlotRules {
  try {
    const raw = localStorage.getItem(defaultsKey(classId));
    if (!raw) return DEFAULT_SLOT_RULES;
    return { ...DEFAULT_SLOT_RULES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SLOT_RULES;
  }
}

export function saveClassDefaults(classId: string, rules: SlotRules) {
  localStorage.setItem(defaultsKey(classId), JSON.stringify(rules));
}

function datetimeLocal(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SlotRulesFields({
  rules,
  onChange,
  includeLock,
}: {
  rules: SlotRules;
  onChange: (next: SlotRules) => void;
  includeLock?: boolean;
}) {
  function set<K extends keyof SlotRules>(key: K, value: SlotRules[K]) {
    onChange({ ...rules, [key]: value });
  }

  return (
    <div className="space-y-3">
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
}: {
  classId: string;
  slotId: string;
  initial: SlotRules;
  onSaved: () => void;
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

  return (
    <div className="border-t border-line pt-3 space-y-3">
      <SlotRulesFields rules={rules} onChange={setRules} includeLock />
      <div className="flex flex-wrap gap-2">
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
  );
}
