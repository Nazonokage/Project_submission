'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { defaultAcademicTerm, termPresets } from '@/lib/term';
import { ThemeToggle } from '@/components/theme-toggle';

type ClassRow = { id: string; name: string; term: string; createdAt: string };

export default function DashboardPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [term, setTerm] = useState(defaultAcademicTerm());
  const [error, setError] = useState<string | null>(null);
  const presets = termPresets();

  async function load() {
    setLoading(true);
    const res = await fetch('/api/classes');
    if (res.ok) {
      const data = await res.json();
      setClasses(data.classes);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openForm() {
    setShowForm((s) => {
      if (!s && !term) setTerm(defaultAcademicTerm());
      return !s;
    });
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, term }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setName('');
    setTerm(defaultAcademicTerm());
    setShowForm(false);
    load();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your classes</h1>
        <div className="flex gap-2">
          <ThemeToggle />
          <button className="btn-primary" onClick={openForm}>
            New class
          </button>
          <button className="btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={createClass} className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Class name</label>
              <input
                className="input"
                required
                placeholder="CS 101 - Intro to Programming"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Term</label>
              <input
                className="input"
                required
                list="term-presets"
                placeholder={defaultAcademicTerm()}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
              <datalist id="term-presets">
                {presets.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {presets.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`text-xs rounded-full border px-2 py-0.5 ${
                      term === p ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted'
                    }`}
                    onClick={() => setTerm(p)}
                  >
                    {p.replace(/^AY /, '')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className="btn-primary">
            Create class
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="text-sm text-muted">No classes yet — create one to get started.</p>
      ) : (
        <div className="grid gap-3">
          {classes.map((c) => (
            <Link key={c.id} href={`/dashboard/${c.id}`} className="card hover:border-accent transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted">{c.term}</p>
                </div>
                <span className="text-muted text-sm">Manage →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
