'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/remember-device', { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        if (!res.ok) return;
        const data = await res.json();
        if (!controller.signal.aborted && typeof data.email === 'string') {
          setRememberedEmail(data.email);
          setEmail(current => current || data.email);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, []);

  async function forgetBrowser() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/remember-device', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not forget this browser. Try again.');
      setRememberedEmail(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not forget this browser'); }
    finally { setLoading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      router.push(data.authenticated ? '/dashboard' : `/login/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form onSubmit={submit} className="card max-w-sm w-full space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Professor login</h1>
          <p className="text-sm text-muted mt-1">
            Enter your email to continue. Remembered browsers can sign in without another code; otherwise, we will email you one.
          </p>
        </div>
        {rememberedEmail && <div className="space-y-1 text-sm text-muted">
          <p>This browser remembers {rememberedEmail}. Use that email to sign in without a code.</p>
          <button type="button" className="underline hover:text-foreground" disabled={loading} onClick={forgetBrowser}>Forget this browser</button>
        </div>}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Continuing…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
