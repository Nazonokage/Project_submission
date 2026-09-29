// Preserve the first spelling while treating trimmed, case-insensitive tags as equal.
export function normalizeTechStack(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    if (typeof item !== 'string') return [];
    const tag = item.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return [];
    seen.add(key);
    return [tag];
  });
}
