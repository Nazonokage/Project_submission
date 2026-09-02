'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ExternalLink, Search } from 'lucide-react';
import { StudentHeader } from '@/components/student/student-header';
import { EmptyState } from '@/components/student/empty-state';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { VerifiedTitle } from '@/components/student/types';

export default function VerifiedTitlesPage() {
  const { classId, slotId } = useParams<{ classId: string; slotId: string }>();
  const router = useRouter();
  const [titles, setTitles] = useState<VerifiedTitle[]>([]);
  const [q, setQ] = useState('');
  const [techFilter, setTechFilter] = useState<string | null>(null);
  const [targetFilter, setTargetFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(query: string) {
    setLoading(true);
    const qs = new URLSearchParams({ slotId, ...(query ? { q: query } : {}) });
    const res = await fetch(`/api/student/titles/verified?${qs}`);
    if (res.status === 401) {
      router.push(`/c/${classId}/login`);
      return;
    }
    if (res.ok) setTitles((await res.json()).titles || []);
    setLoading(false);
  }

  useEffect(() => {
    const handle = setTimeout(() => load(q), q ? 300 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, slotId]);

  const techOptions = useMemo(() => {
    const set = new Set<string>();
    titles.forEach((t) => t.techStack?.forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [titles]);

  const targetOptions = useMemo(() => {
    const set = new Set<string>();
    titles.forEach((t) => {
      if (t.targetUsers) set.add(t.targetUsers);
    });
    return [...set].sort();
  }, [titles]);

  const filtered = titles.filter((t) => {
    if (techFilter && !(t.techStack || []).includes(techFilter)) return false;
    if (targetFilter && t.targetUsers !== targetFilter) return false;
    return true;
  });

  async function logout() {
    await fetch('/api/student/logout', { method: 'POST' });
    router.push(`/c/${classId}/login`);
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <StudentHeader
        title="Verified titles"
        backHref={`/c/${classId}/${slotId}`}
        backLabel="Back to your project"
        onLogout={logout}
      />

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
        <Input
          className="pl-9"
          placeholder="Search by title, description, tech stack, or target users…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {(techOptions.length > 0 || targetOptions.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {techOptions.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="sm"
              variant={techFilter === tag ? 'default' : 'outline'}
              onClick={() => setTechFilter((cur) => (cur === tag ? null : tag))}
            >
              {tag}
            </Button>
          ))}
          {targetOptions.map((target) => (
            <Button
              key={target}
              type="button"
              size="sm"
              variant={targetFilter === target ? 'secondary' : 'outline'}
              onClick={() => setTargetFilter((cur) => (cur === target ? null : target))}
            >
              {target}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No verified titles yet"
          description="Nothing matches this search, or the professor has not verified any titles in this slot."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id} className="rounded-xl shadow-sm">
              <CardHeader className="pb-2">
                <p className="font-medium leading-snug">{t.text}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted">{t.description}</p>
                {t.techStack && t.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.techStack.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {t.targetUsers && <p className="text-sm text-muted">Target users: {t.targetUsers}</p>}
                {t.members?.length > 0 && (
                  <p className="text-xs text-muted">By: {t.members.join(', ')}</p>
                )}
                {(t.repoUrl || t.deploymentUrl) && (
                  <div className="flex flex-col gap-1 text-sm">
                    {t.repoUrl && (
                      <a
                        href={t.repoUrl}
                        className="text-primary hover:underline inline-flex items-center gap-1 truncate"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        Repo
                      </a>
                    )}
                    {t.deploymentUrl && (
                      <a
                        href={t.deploymentUrl}
                        className="text-primary hover:underline inline-flex items-center gap-1 truncate"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        Live
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
