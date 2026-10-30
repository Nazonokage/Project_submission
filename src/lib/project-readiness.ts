export function isGithubRepoUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname);
  } catch { return false; }
}

export function githubRepoUrlError(value: unknown): string | null {
  if (isGithubRepoUrl(value)) return null;
  if (typeof value !== 'string' || !value.trim()) return 'Add your GitHub repository link.';
  try {
    const url = new URL(value.trim());
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return 'This looks like a GitHub profile. Open your project repository and copy its link.';
      if (parts.length > 2) return 'Copy the repository home page link, without file, folder, branch, or commit paths: https://github.com/owner/repository';
    }
  } catch { /* Show the expected format below. */ }
  return 'Use a full GitHub repository link: https://github.com/owner/repository (https:// required, no extra paths, query parameters, or # fragments).';
}

export function projectRequirementsError(title: { description?: unknown; repoUrl?: unknown }): string | null {
  return typeof title.description === 'string' && title.description.trim() && isGithubRepoUrl(title.repoUrl)
    ? null : 'Complete your project description / abstract and a valid GitHub repository URL in Submissions before using project tools.';
}

export function projectApprovalError(title: { status?: unknown }): string | null {
  return title.status === 'verified' ? null : 'Your project stays in Planning until your professor approves it. Board changes unlock after approval.';
}
