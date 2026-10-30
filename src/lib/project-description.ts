type ProjectOverview = { description?: string | null; documentation?: unknown };
type DocTemplate = { fieldKey: string; required: boolean };

function documentValues(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// Existing templates keep their key, but their value comes from titles.description.
export function projectDescription(title: ProjectOverview): string {
  const legacy = documentValues(title.documentation).abstract;
  return title.description?.trim() || (typeof legacy === 'string' ? legacy.trim() : '');
}

export function preservedAbstracts(title: ProjectOverview): string[] {
  const archived = documentValues(title.documentation)._legacyAbstracts;
  const values = Array.isArray(archived) ? archived.filter((v): v is string => typeof v === 'string') : [];
  const legacy = documentValues(title.documentation).abstract;
  if (typeof legacy === 'string' && legacy.trim() && legacy.trim() !== projectDescription(title)) values.push(legacy);
  return [...new Set(values)];
}

export function consolidateDescription(title: ProjectOverview, description = projectDescription(title), documentation: unknown = title.documentation) {
  const doc = { ...documentValues(documentation) };
  delete doc.abstract;
  delete doc._legacyAbstracts;
  const archived = preservedAbstracts(title);
  if (archived.length) doc._legacyAbstracts = archived;
  return { description: description.trim(), documentation: doc };
}

export function missingDocumentationCount(templates: DocTemplate[], title: ProjectOverview): number {
  return templates.filter(t => {
    if (!t.required) return false;
    const value = t.fieldKey === 'abstract' ? projectDescription(title) : documentValues(title.documentation)[t.fieldKey];
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  }).length;
}
