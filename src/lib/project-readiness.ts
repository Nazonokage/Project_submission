export function isGithubRepoUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname);
  } catch { return false; }
}
export function projectRequirementsError(title: { description?: unknown; repoUrl?: unknown }): string | null {
  return typeof title.description === 'string' && title.description.trim() && isGithubRepoUrl(title.repoUrl)
    ? null : 'Complete your project abstract and a valid GitHub repository URL in Submissions before using project tools.';
}
