'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type StudentMatch = { name: string; idNumber: string };

export function LoginForm({ classId, className, term }: { classId: string; className?: string; term?: string }) {
  const router = useRouter();
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<StudentMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const passwordRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setMatches([]); setActiveIndex(-1); setSearchError(false);
    if (!open || query.trim().length < 2) { setSearching(false); return () => controller.abort(); }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/classes/${encodeURIComponent(classId)}/directory?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('Search unavailable');
        const data = await res.json();
        if (!controller.signal.aborted) setMatches(data.students || []);
      } catch {
        if (!controller.signal.aborted) setSearchError(true);
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [classId, query, open]);
  function pick(student: StudentMatch) {
    setIdNumber(student.idNumber); setQuery(`${student.name} · ${student.idNumber}`);
    setOpen(false); setActiveIndex(-1); passwordRef.current?.focus();
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const res = await fetch('/api/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId, idNumber, password, rememberMe }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push(`/c/${classId}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); }
    finally { setLoading(false); }
  }
  return <Card className="w-full max-w-md shadow-md">
    <CardHeader><CardTitle className="text-2xl">Student Login</CardTitle><CardDescription>{className || 'Sign in to your class'}{term ? ` / ${term}` : ''}</CardDescription></CardHeader>
    <CardContent><form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="studentSearch">Name or ID number</Label>
        <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
          <Input id="studentSearch" ref={searchRef} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="student-matches" aria-activedescendant={open && activeIndex >= 0 ? `student-match-${activeIndex}` : undefined} autoComplete="off" required maxLength={100} placeholder="Search by name or ID" value={query}
            onChange={e => { setQuery(e.target.value); setIdNumber(e.target.value.trim()); setActiveIndex(-1); setOpen(true); }} onFocus={() => setOpen(true)}
            onKeyDown={event => {
              if (event.key === 'Escape') { setOpen(false); return; }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault(); setOpen(true);
                if (matches.length) setActiveIndex(index => index < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length);
              }
              if (event.key === 'Enter' && open && matches.length) { event.preventDefault(); pick(matches[activeIndex >= 0 ? activeIndex : 0]); }
            }} />
          {open && <ul id="student-matches" role="listbox" aria-label="Matching students" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-card p-1 shadow-md">
            {matches.map((student, index) => <li key={student.idNumber} role="presentation"><button id={`student-match-${index}`} role="option" aria-selected={activeIndex === index} type="button" className={`w-full rounded px-3 py-2 text-left text-sm hover:bg-secondary ${activeIndex === index ? 'bg-secondary' : ''}`} onMouseDown={event => event.preventDefault()} onClick={() => pick(student)}><span className="block font-medium">{student.name}</span><span className="text-xs text-muted">{student.idNumber}</span></button></li>)}
            {!matches.length && <li role="presentation" className="px-3 py-2 text-sm text-muted">{searching ? 'Searching…' : searchError ? 'Search unavailable. You can still enter your ID.' : query.trim().length < 2 ? 'Type at least two characters to search.' : 'No matches. You can still enter your ID.'}</li>}
          </ul>}
        </div>
        <p className="text-xs text-muted">Search for your name, or enter your ID directly.</p>
      </div>
      <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" ref={passwordRef} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />Remember me for 7 days</label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</Button>
      <p className="text-center text-sm"><Link href="/">Back to home</Link></p>
    </form></CardContent>
  </Card>;
}
