'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { normalizeTechStack } from '@/lib/tech-stack';

export function TechStackInput({ value, onChange, suggestionsUrl, placeholder = 'Type a tag and press Enter' }: {
  value: string[]; onChange: (next: string[]) => void; suggestionsUrl?: string; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const suggestions = useQuery<{ tags: string[] }>({
    queryKey: ['tech-tags', suggestionsUrl], enabled: !!suggestionsUrl, staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(suggestionsUrl!, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Suggestions unavailable');
      return response.json();
    },
  });
  const tags = normalizeTechStack(value);
  const matches = normalizeTechStack(suggestions.data?.tags).filter(tag =>
    !tags.some(selected => selected.toLowerCase() === tag.toLowerCase()) &&
    tag.toLowerCase().includes(draft.trim().toLowerCase())
  ).slice(0, 8);
  const expanded = open && matches.length > 0;
  function add(raw: string) {
    const tag = raw.trim();
    if (tag) onChange(normalizeTechStack([...tags, tag]));
    setDraft(''); setActive(-1); setOpen(false);
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-1.5">{tags.map(tag => <Badge key={tag} variant="secondary" className="gap-1 pl-2">
      {tag}<button type="button" className="rounded-full hover:bg-black/10" onClick={() => onChange(tags.filter(t => t !== tag))} aria-label={`Remove ${tag}`}><X className="h-3 w-3" /></button>
    </Badge>)}</div>
    <div className="flex gap-2">
      <div className="relative flex-1 min-w-0">
        <Input role="combobox" aria-label="Tech stack tag" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-list`} aria-activedescendant={expanded && active >= 0 && active < matches.length ? `${id}-${active}` : undefined}
          value={draft} placeholder={placeholder} autoComplete="off" onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }}
          onChange={e => { setDraft(e.target.value); setOpen(true); setActive(-1); }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault(); setOpen(true);
              setActive(current => matches.length ? (current + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length : -1);
            } else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setActive(-1); }
            else if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(expanded && active >= 0 ? matches[active] || draft : draft.replace(/,/g, '')); }
          }} />
        {expanded && <ul id={`${id}-list`} role="listbox" aria-label="Suggested tech tags" className="absolute z-50 mt-1 w-full rounded-lg border bg-background p-1 shadow-lg max-h-56 overflow-y-auto">
          {matches.map((tag, index) => <li key={tag} id={`${id}-${index}`} role="option" aria-selected={active === index} className={`cursor-pointer rounded px-3 py-2 text-sm ${active === index ? 'bg-secondary' : 'hover:bg-secondary'}`} onMouseDown={e => e.preventDefault()} onClick={() => add(tag)}>{tag}</li>)}
        </ul>}
      </div>
      <Button type="button" variant="outline" disabled={!draft.trim()} onClick={() => add(draft)}>Add</Button>
    </div>
    <p className="text-xs text-muted">{suggestions.isError ? 'Suggestions unavailable. You can still add your own tags.' : 'Choose a tag used in this slot, or type a new one.'}</p>
  </div>;
}
