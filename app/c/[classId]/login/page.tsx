'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function StudentLoginPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      router.push(`/c/${classId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="card max-w-sm w-full space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Class login</h1>
          <p className="text-sm text-muted mt-1">Use the ID number and password your professor gave you.</p>
        </div>
        <div>
          <label className="label">ID number</label>
          <input className="input" required value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
