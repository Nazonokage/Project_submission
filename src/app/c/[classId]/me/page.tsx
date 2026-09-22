'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { StudentHeader } from '@/components/student/student-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type Membership = { groupId: string; status: string; slotId: string; slotLabel: string };
type Me = {
  id: string;
  name: string;
  idNumber: string;
  lastLoginAt: string | null;
  classId: string;
  memberships?: Membership[];
};

export default function StudentAccountPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/student/me');
      if (res.status === 401) {
        router.push(`/c/${classId}/login`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not load account');
        setLoading(false);
        return;
      }
      if (data.classId && data.classId !== classId) {
        setError('This account belongs to a different class.');
        setLoading(false);
        return;
      }
      setMe(data);
      setLoading(false);
    })();
  }, [classId, router]);

  async function logout() {
    await fetch('/api/student/logout', { method: 'POST' });
    router.push(`/c/${classId}/login`);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/student/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Could not change password');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.success('Password updated. Use it the next time you log in.');
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <StudentHeader
        title="My account"
        subtitle="Your class identity. Ask your professor if you need a name or ID change."
        backHref={`/c/${classId}`}
        backLabel="Back to class"
        onLogout={logout}
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : me ? (
        <>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted">Name</span> · {me.name}
              </p>
              <p>
                <span className="text-muted">ID number</span> · <span className="font-mono">{me.idNumber}</span>
              </p>
              <p>
                <span className="text-muted">Last login</span> ·{' '}
                {me.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString() : 'Never'}
              </p>
              {me.memberships && me.memberships.length > 0 && (
                <div className="pt-2 space-y-1">
                  <p className="text-muted">Groups / slots</p>
                  {me.memberships.map((m) => (
                    <p key={`${m.slotId}-${m.groupId}`}>
                      {m.slotLabel} · {m.status}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={changePassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={4}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Update password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
