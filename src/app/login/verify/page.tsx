'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';
  const [otp, setOtp] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-sm w-full space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Enter your code</h1>
        <p className="text-sm text-muted mt-1">
          Sent to <span className="font-medium">{email}</span>. It expires in 10 minutes.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="otp">
          6-digit code
        </label>
        <input
          id="otp"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className="input text-center text-lg tracking-[0.5em]"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        />
      </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Remember me for 7 days
          </label>
          <p className="text-xs text-muted">Skip login codes on this browser for 7 days, even after logging out. Otherwise, your session expires after 24 hours.</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading || otp.length !== 6}>
        {loading ? 'Verifying…' : 'Verify & continue'}
      </button>
    </form>
  );
}

export default function VerifyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </main>
  );
}
