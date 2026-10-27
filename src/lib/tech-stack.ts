// Curated predefined catalog of standard technologies with canonical spelling and casing.
export const PREDEFINED_TECH_STACK: string[] = [
  // Programming Languages
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C++', 'C', 'Go', 'Rust',
  'PHP', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'SQL', 'HTML5', 'CSS3', 'R', 'Scala',

  // Frontend Frameworks, UI & Libraries
  'React', 'Next.js', 'Vue.js', 'Nuxt.js', 'Angular', 'Svelte', 'SvelteKit',
  'Remix', 'Astro', 'Vite', 'Tailwind CSS', 'Bootstrap', 'Shadcn UI',
  'Material UI', 'Chakra UI', 'Redux', 'Zustand',

  // Mobile & Cross-Platform
  'React Native', 'Flutter', 'Expo', 'Android', 'iOS', 'Ionic', 'Electron',

  // Backend & APIs
  'Node.js', 'Express', 'NestJS', 'FastAPI', 'Django', 'Flask', 'Spring Boot',
  'ASP.NET Core', 'Laravel', 'Ruby on Rails', 'GraphQL', 'REST API', 'WebSockets', 'gRPC',

  // Databases & ORMs
  'PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Supabase', 'Firebase',
  'Neon', 'Prisma', 'Drizzle ORM', 'TypeORM', 'Mongoose',

  // Cloud, DevOps & Tools
  'Docker', 'Kubernetes', 'AWS', 'Google Cloud', 'Azure', 'Vercel', 'Netlify',
  'Cloudflare', 'Git', 'GitHub', 'Linux', 'Nginx', 'CI/CD',

  // AI & Machine Learning
  'PyTorch', 'TensorFlow', 'OpenCV', 'Hugging Face', 'OpenAI', 'LangChain',
  'Pandas', 'NumPy', 'scikit-learn'
];

// Top popular technologies for 1-click quick-add pills
export const POPULAR_TECH_TAGS: string[] = [
  'React', 'Next.js', 'TypeScript', 'Node.js', 'Python', 'Tailwind CSS',
  'PostgreSQL', 'MongoDB', 'FastAPI', 'Docker', 'Flutter', 'Supabase',
  'Express', 'Firebase', 'Django', 'MySQL', 'Vue.js', 'REST API'
];

// Common aliases, abbreviations, and frequent typos mapped directly to canonical names.
export const TECH_ALIASES: Record<string, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  py: 'Python',
  pyton: 'Python',
  phyton: 'Python',
  pyhton: 'Python',
  recat: 'React',
  reacr: 'React',
  reactjs: 'React',
  next: 'Next.js',
  nextjs: 'Next.js',
  nxtjs: 'Next.js',
  node: 'Node.js',
  nodejs: 'Node.js',
  vue: 'Vue.js',
  vuejs: 'Vue.js',
  angularjs: 'Angular',
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  tlwind: 'Tailwind CSS',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  psql: 'PostgreSQL',
  postgre: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  expressjs: 'Express',
  dj: 'Django',
  django: 'Django',
  fastapi: 'FastAPI',
  flutter: 'Flutter',
  fluter: 'Flutter',
  docker: 'Docker',
  dokcer: 'Docker',
  k8s: 'Kubernetes',
  kube: 'Kubernetes',
  github: 'GitHub',
  githhub: 'GitHub',
  drizzle: 'Drizzle ORM',
  prisma: 'Prisma',
  supabase: 'Supabase',
  firebase: 'Firebase',
  electron: 'Electron',
  rn: 'React Native',
  html: 'HTML5',
  css: 'CSS3',
};

// Map lowercase canonical tag -> official canonical string for O(1) lookup
const CANONICAL_MAP = new Map<string, string>(
  PREDEFINED_TECH_STACK.map((tag) => [tag.toLowerCase(), tag])
);

/**
 * Resolves a raw input string to its canonical casing or alias if known;
 * otherwise preserves the trimmed user input.
 */
export function canonicalizeTechTag(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();

  // 1. Direct alias / typo match
  if (TECH_ALIASES[lower]) {
    return TECH_ALIASES[lower];
  }

  // 2. Direct canonical name match (fixes casing like "react" -> "React")
  if (CANONICAL_MAP.has(lower)) {
    return CANONICAL_MAP.get(lower)!;
  }

  return trimmed;
}

/**
 * Normalizes an array of tech stack tags:
 * - Trims whitespace
 * - Canonicalizes casing and common aliases
 * - Deduplicates case-insensitively
 */
export function normalizeTechStack(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const canonical = canonicalizeTechTag(item);
    const key = canonical.toLowerCase();
    if (!canonical || seen.has(key)) return [];
    seen.add(key);
    return [canonical];
  });
}

/**
 * Fast Levenshtein distance calculation for typo tolerance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = d[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return d[n];
}

export type TechSuggestion = {
  tag: string;
  source: 'canonical' | 'slot' | 'typo';
  reason?: string;
};

/**
 * Suggests matching technologies for a search draft:
 * - Prioritizes exact matches, prefix matches, and aliases
 * - Catches typos via Levenshtein distance
 * - Merges slot-specific tags with predefined standard tags
 * - Excludes already selected tags
 */
export function getTechSuggestions(
  draft: string,
  slotTags: string[] = [],
  selectedTags: string[] = [],
  limit = 10
): TechSuggestion[] {
  const query = draft.trim().toLowerCase();
  const selectedSet = new Set(selectedTags.map((t) => t.toLowerCase()));

  // Build combined tag list (slot tags + predefined tags), preferring canonical casing
  const tagMap = new Map<string, string>();
  for (const tag of PREDEFINED_TECH_STACK) {
    tagMap.set(tag.toLowerCase(), tag);
  }
  for (const raw of slotTags) {
    const canonical = canonicalizeTechTag(raw);
    const lower = canonical.toLowerCase();
    if (!tagMap.has(lower)) {
      tagMap.set(lower, canonical);
    }
  }

  // When draft is empty, show slot tags first, followed by top popular predefined tags
  if (!query) {
    const defaultList: TechSuggestion[] = [];
    const added = new Set<string>();

    for (const raw of slotTags) {
      const canonical = canonicalizeTechTag(raw);
      const lower = canonical.toLowerCase();
      if (!selectedSet.has(lower) && !added.has(lower)) {
        added.add(lower);
        defaultList.push({ tag: canonical, source: 'slot' });
      }
    }

    for (const tag of POPULAR_TECH_TAGS) {
      const lower = tag.toLowerCase();
      if (!selectedSet.has(lower) && !added.has(lower)) {
        added.add(lower);
        defaultList.push({ tag, source: 'canonical' });
      }
      if (defaultList.length >= limit) break;
    }

    return defaultList.slice(0, limit);
  }

  const exact: TechSuggestion[] = [];
  const prefix: TechSuggestion[] = [];
  const substring: TechSuggestion[] = [];
  const fuzzy: { item: TechSuggestion; dist: number }[] = [];
  const added = new Set<string>();

  // 1. Check direct alias (e.g., 'recat' -> 'React', 'phyton' -> 'Python')
  const aliasTarget = TECH_ALIASES[query];
  if (aliasTarget) {
    const lower = aliasTarget.toLowerCase();
    if (!selectedSet.has(lower) && !added.has(lower)) {
      added.add(lower);
      exact.push({
        tag: aliasTarget,
        source: 'typo',
        reason: `Matched "${draft.trim()}"`,
      });
    }
  }

  // 2. Iterate through all known tags
  for (const [lower, tag] of tagMap.entries()) {
    if (selectedSet.has(lower) || added.has(lower)) continue;

    if (lower === query) {
      added.add(lower);
      exact.push({ tag, source: 'canonical' });
    } else if (lower.startsWith(query)) {
      added.add(lower);
      prefix.push({ tag, source: 'canonical' });
    } else if (lower.includes(query)) {
      added.add(lower);
      substring.push({ tag, source: 'canonical' });
    } else if (query.length >= 3) {
      const dist = levenshteinDistance(query, lower);
      const maxDist = query.length <= 4 ? 1 : 2;
      if (dist <= maxDist) {
        added.add(lower);
        fuzzy.push({
          item: { tag, source: 'typo', reason: `Did you mean ${tag}?` },
          dist,
        });
      }
    }
  }

  fuzzy.sort((a, b) => a.dist - b.dist);

  const combined = [
    ...exact,
    ...prefix,
    ...substring,
    ...fuzzy.map((f) => f.item),
  ];

  return combined.slice(0, limit);
}
