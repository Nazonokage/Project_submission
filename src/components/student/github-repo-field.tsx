'use client';

import { useState } from 'react';
import { githubRepoUrlError } from '@/lib/project-readiness';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function GithubRepoField({ id, value, onChange }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const error = (touched || value.length > 0) ? githubRepoUrlError(value) : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>GitHub repository (required)</Label>
      <Input
        id={id}
        type="url"
        required
        placeholder="https://github.com/owner/repository"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={!!error}
        aria-describedby={`${id}-guide${error ? ` ${id}-error` : ''}`}
        className={error ? 'border-destructive' : undefined}
      />
      <div id={`${id}-guide`} className="space-y-1 text-xs text-muted">
        <p>Open your project repository on GitHub, select its Code tab, and copy the link from your browser&apos;s address bar.</p>
        <p>Example: <code className="break-all">https://github.com/your-username/your-project</code></p>
        <p>Include both the owner and repository name. A profile, GitHub Pages site, or link to a file or folder will not work.</p>
      </div>
      {error && <p id={`${id}-error`} className="text-xs text-destructive" aria-live="polite">{error}</p>}
    </div>
  );
}
