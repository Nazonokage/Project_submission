'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ChevronDown, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type DirectoryStudent = { name: string; idNumber: string };

const recentKey = (classId: string) => `ps-recent-students:${classId}`;

export function LoginForm({
  classId,
  className,
  term,
}: {
  classId: string;
  className?: string;
  term?: string;
}) {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<DirectoryStudent[]>([]);
  const [recent, setRecent] = useState<DirectoryStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/classes/${classId}/directory`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { students: [] }))
      .then((data) => setStudents(data.students || []))
      .catch(() => setStudents([]));
    try {
      const raw = localStorage.getItem(recentKey(classId));
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [classId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 40);
    return students
      .filter((s) => s.name.toLowerCase().includes(q) || s.idNumber.toLowerCase().includes(q))
      .slice(0, 40);
  }, [students, query]);

  function pick(student: DirectoryStudent) {
    setIdNumber(student.idNumber);
    setQuery(`${student.name} · ${student.idNumber}`);
    setOpen(false);
    setTimeout(() => passwordRef.current?.focus(), 0);
  }

  function remember(student: DirectoryStudent) {
    const next = [student, ...recent.filter((s) => s.idNumber !== student.idNumber)].slice(0, 4);
    setRecent(next);
    try {
      localStorage.setItem(recentKey(classId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, idNumber, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      const match = students.find((s) => s.idNumber === idNumber);
      if (match) remember(match);
      toast.success('Welcome in');
      router.push(`/c/${classId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl">Student Login</CardTitle>
        <CardDescription>
          {className ? (
            <>
              <span className="font-medium text-foreground">{className}</span>
              {term ? <span> · {term}</span> : null}
            </>
          ) : (
            'Use the ID number and password your professor gave you.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="studentSearch">Name or ID number</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <Input
                id="studentSearch"
                autoComplete="off"
                className="pl-9 pr-9"
                placeholder="Search by name or ID"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIdNumber(e.target.value.trim());
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
              />
              <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted" />
              {open && (filtered.length > 0 || recent.length > 0) && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-card py-1 shadow-md">
                  {query.trim() === '' && recent.length > 0 && (
                    <>
                      <li className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted">Recently used</li>
                      {recent.map((s) => (
                        <li key={`r-${s.idNumber}`}>
                          <button
                            type="button"
                            className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-secondary"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pick(s)}
                          >
                            <span className="font-medium">{s.name}</span>
                            <span className="text-xs text-muted">{s.idNumber}</span>
                          </button>
                        </li>
                      ))}
                      <li className="my-1 border-t border-line" />
                    </>
                  )}
                  {filtered.map((s) => (
                    <li key={s.idNumber}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-secondary"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(s)}
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted">{s.idNumber}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {idNumber && (
              <p className="text-xs text-muted">
                Signing in as ID <span className="font-medium text-foreground">{idNumber}</span>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loading || !idNumber}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
          <p className="text-center text-sm">
            <Link href="/" className="text-muted hover:text-foreground hover:underline">
              ← Back to home
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
