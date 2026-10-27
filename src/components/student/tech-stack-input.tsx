'use client';

import { useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  POPULAR_TECH_TAGS,
  canonicalizeTechTag,
  getTechSuggestions,
  normalizeTechStack,
} from '@/lib/tech-stack';

export function TechStackInput({
  value,
  onChange,
  suggestionsUrl,
  placeholder = 'Search technologies or type a new one…',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestionsUrl?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useQuery<{ tags: string[] }>({
    queryKey: ['tech-tags', suggestionsUrl],
    enabled: !!suggestionsUrl,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(suggestionsUrl!, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Suggestions unavailable');
      return response.json();
    },
  });

  const tags = normalizeTechStack(value);
  const selectedSet = new Set(tags.map((t) => t.toLowerCase()));
  const matches = getTechSuggestions(draft, suggestions.data?.tags, tags, 10);

  // Determine if draft is a unique custom tag not already in matches
  const trimmedDraft = draft.trim();
  const canonicalDraft = canonicalizeTechTag(trimmedDraft);
  const hasExactInMatches = matches.some(
    (m) => m.tag.toLowerCase() === trimmedDraft.toLowerCase()
  );
  const isAlreadySelected = selectedSet.has(trimmedDraft.toLowerCase()) || selectedSet.has(canonicalDraft.toLowerCase());
  const showCustomOption = trimmedDraft.length > 0 && !hasExactInMatches && !isAlreadySelected;

  const totalOptionsCount = matches.length + (showCustomOption ? 1 : 0);
  const expanded = open && (matches.length > 0 || showCustomOption);

  function addTag(raw: string) {
    const canonical = canonicalizeTechTag(raw);
    if (canonical) {
      onChange(normalizeTechStack([...tags, canonical]));
    }
    setDraft('');
    setActive(-1);
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeTag(tagToRemove: string) {
    onChange(tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()));
  }

  // Quick-add items: popular technologies not yet added
  const quickPillOptions = POPULAR_TECH_TAGS.filter(
    (pt) => !selectedSet.has(pt.toLowerCase())
  ).slice(0, 6);

  return (
    <div className="space-y-2.5">
      {/* Selected Tags Chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-secondary/30 border border-border/40">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium bg-background shadow-xs hover:bg-background/80 transition-colors"
            >
              <span>{tag}</span>
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search & Autocomplete Input */}
      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <Input
            ref={inputRef}
            role="combobox"
            aria-label="Search tech stack"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={`${id}-list`}
            aria-activedescendant={
              expanded && active >= 0 ? `${id}-${active}` : undefined
            }
            value={draft}
            placeholder={placeholder}
            autoComplete="off"
            className="pl-9 pr-8"
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay slightly so onMouseDown / onClick on suggestions execute before closing
              setTimeout(() => {
                setOpen(false);
                setActive(-1);
              }, 180);
            }}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setOpen(true);
                if (totalOptionsCount > 0) {
                  setActive((current) =>
                    (current + (e.key === 'ArrowDown' ? 1 : -1) + totalOptionsCount) % totalOptionsCount
                  );
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
                setActive(-1);
              } else if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                if (active >= 0 && active < matches.length) {
                  addTag(matches[active].tag);
                } else if (active === matches.length && showCustomOption) {
                  addTag(trimmedDraft);
                } else if (trimmedDraft) {
                  // Fall back to top suggestion if typo/alias matched, otherwise trimmed input
                  const topMatch = matches[0];
                  if (topMatch && (topMatch.source === 'typo' || topMatch.tag.toLowerCase() === trimmedDraft.toLowerCase())) {
                    addTag(topMatch.tag);
                  } else {
                    addTag(trimmedDraft.replace(/,/g, ''));
                  }
                }
              }
            }}
          />

          {draft && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              onClick={() => {
                setDraft('');
                setActive(-1);
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Autocomplete Dropdown List */}
          {expanded && (
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-label="Suggested technologies"
              className="absolute z-50 mt-1.5 w-full rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-lg max-h-64 overflow-y-auto"
            >
              {!draft.trim() && (
                <li className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Suggestions (Click to add)
                </li>
              )}

              {matches.map((item, index) => (
                <li
                  key={item.tag}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={active === index}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                    active === index
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-accent/70'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(item.tag)}
                >
                  <span className="flex items-center gap-2">
                    {item.source === 'typo' ? (
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span>{item.tag}</span>
                  </span>

                  {item.reason && (
                    <span className="text-[11px] text-muted-foreground ml-2 italic">
                      {item.reason}
                    </span>
                  )}
                  {item.source === 'slot' && !item.reason && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 bg-secondary/80 px-1.5 py-0.5 rounded">
                      Used in slot
                    </span>
                  )}
                </li>
              ))}

              {/* Custom Tag Option if not in pre-defined matches */}
              {showCustomOption && (
                <li
                  id={`${id}-${matches.length}`}
                  role="option"
                  aria-selected={active === matches.length}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-sm flex items-center gap-2 border-t border-border/40 text-primary transition-colors ${
                    active === matches.length ? 'bg-primary/10 font-medium' : 'hover:bg-primary/5'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(trimmedDraft)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    Add <strong>&ldquo;{trimmedDraft}&rdquo;</strong> as custom tag
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>

        <Button
          type="button"
          disabled={!trimmedDraft}
          onClick={() => addTag(trimmedDraft)}
          className="shrink-0 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Quick-Add Popular Suggestions */}
      {quickPillOptions.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 text-xs text-muted-foreground pt-0.5">
          <span className="text-[11px] font-medium text-muted mr-1">Quick add:</span>
          {quickPillOptions.map((item) => (
            <button
              key={item}
              type="button"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60 bg-secondary/20 hover:bg-secondary hover:text-foreground text-[11px] font-medium transition-colors"
              onClick={() => addTag(item)}
            >
              <Plus className="h-3 w-3 text-muted" />
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
