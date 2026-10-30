'use client';

import { useId, useState } from 'react';

export function StudentPassword({ classId, studentId }: { classId: string; studentId: string }) {
  const fieldId = useId();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function recover(action: 'reveal' | 'reset') {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/classes/${classId}/students/${studentId}/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not retrieve the password');
      setPassword(data.password); setVisible(true);
      setMessage(action === 'reset' ? 'Password reset to 2026. The student can now sign in with it.' : 'This password matches the student’s current account.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not retrieve the password'); }
    finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(password); setMessage('Password copied'); }
    catch { setError('Could not copy. Select the password and copy it manually.'); }
  }

  return <div className="space-y-2">
    <label htmlFor={fieldId} className="label">Student login password</label>
    <div className="flex flex-wrap gap-2">
      <input id={fieldId} className="input min-w-0 flex-1 font-mono" type={visible ? 'text' : 'password'} value={password} readOnly autoComplete="off" placeholder="Hidden" />
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => password ? setVisible(!visible) : void recover('reveal')}>{visible ? 'Hide password' : 'Show password'}</button>
      {password && <button type="button" className="btn-secondary" onClick={copy}>Copy password</button>}
    </div>
    <p className="text-xs text-muted">Resetting replaces the current password with 2026 and signs out existing student sessions.</p>
    <button type="button" className="btn-secondary" disabled={busy} onClick={() => recover('reset')}>{busy ? 'Working…' : 'Reset password to 2026'}</button>
    {message && <p role="status" className="text-sm text-ok">{message}</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
  </div>;
}
