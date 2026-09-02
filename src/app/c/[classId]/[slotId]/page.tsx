'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type Member = { id: string; name: string; idNumber: string };
type Group = { id: string; status: 'forming' | 'locked'; maxSize: number } | null;
type Title = {
  id: string;
  text: string;
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  status: 'pending' | 'verified' | 'rejected';
  repoUrl: string | null;
  deploymentUrl: string | null;
};
type Invite = { invite: { id: string }; groupId: string; invitedBy: { name: string } };

export default function SlotDashboardPage() {
  const { classId, slotId } = useParams<{ classId: string; slotId: string }>();
  const router = useRouter();

  const [group, setGroup] = useState<Group>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [without, setWithout] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const groupRes = await fetch(`/api/student/groups?slotId=${slotId}`);
    if (groupRes.status === 401) {
      router.push(`/c/${classId}/login`);
      return;
    }
    if (groupRes.ok) {
      const data = await groupRes.json();
      setGroup(data.group);
      setMembers(data.members || []);
    }

    const [withoutRes, invitesRes] = await Promise.all([
      fetch(`/api/student/without-group?slotId=${slotId}`),
      fetch(`/api/student/invites?slotId=${slotId}`),
    ]);
    if (withoutRes.ok) setWithout((await withoutRes.json()).students);
    if (invitesRes.ok) setInvites((await invitesRes.json()).invites);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, slotId]);

  useEffect(() => {
    if (group) {
      fetch(`/api/student/titles?slotId=${slotId}`)
        .then((r) => (r.ok ? r.json() : { titles: [] }))
        .then((d) => setTitles(d.titles || []));
    }
  }, [group, slotId]);

  async function createGroup() {
    const res = await fetch('/api/student/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId }),
    });
    if (res.ok) loadAll();
  }

  async function invite(studentId: string) {
    if (!group) return;
    await fetch(`/api/student/groups/${group.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    });
    loadAll();
  }

  async function respond(inviteId: string, action: 'accept' | 'decline') {
    await fetch(`/api/student/invites/${inviteId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    loadAll();
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Project slot</h1>
        <Link href={`/c/${classId}/${slotId}/verified`} className="text-sm text-accent hover:underline">
          View verified titles →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="card space-y-2">
              <p className="font-medium text-sm">Group invites</p>
              {invites.map((inv) => (
                <div key={inv.invite.id} className="flex items-center justify-between text-sm">
                  <span>{inv.invitedBy.name} invited you to their group</span>
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={() => respond(inv.invite.id, 'accept')}>
                      Accept
                    </button>
                    <button className="btn-secondary" onClick={() => respond(inv.invite.id, 'decline')}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Group status */}
          {!group ? (
            <div className="card space-y-3">
              <p className="text-sm">You don't have a group for this project yet.</p>
              <button className="btn-primary" onClick={createGroup}>
                Create a group
              </button>
              {without.length > 0 && <p className="text-xs text-muted">Or wait for an invite from a classmate.</p>}
            </div>
          ) : (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Your group</p>
                <span className={`badge ${group.status === 'locked' ? 'bg-green-100 text-ok' : 'bg-yellow-100 text-warn'}`}>
                  {group.status === 'locked' ? 'Locked' : `Forming (${members.length}/${group.maxSize})`}
                </span>
              </div>
              <ul className="text-sm text-muted list-disc list-inside">
                {members.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>

              {group.status === 'forming' && without.length > 0 && (
                <div className="pt-2 border-t border-line">
                  <p className="text-sm font-medium mb-2">Students without a group</p>
                  <div className="flex flex-col gap-1">
                    {without.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span>{s.name}</span>
                        <button className="btn-secondary" onClick={() => invite(s.id)}>
                          Invite
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Title submission */}
          {group && group.status === 'locked' && (
            <TitleSubmission slotId={slotId} titles={titles} onChange={loadAll} />
          )}
        </>
      )}
    </main>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-warn',
  verified: 'bg-green-100 text-ok',
  rejected: 'bg-red-100 text-danger',
};

function TitleSubmission({
  slotId,
  titles,
  onChange,
}: {
  slotId: string;
  titles: Title[];
  onChange: () => void;
}) {
  const [text, setText] = useState('');
  const [description, setDescription] = useState('');
  const [techStack, setTechStack] = useState('');
  const [targetUsers, setTargetUsers] = useState('');
  const [dupWarning, setDupWarning] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [repoDrafts, setRepoDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (text.trim().length < 3) {
      setDupWarning([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/student/titles/check?slotId=${slotId}&text=${encodeURIComponent(text)}`
      );
      if (res.ok) {
        const data = await res.json();
        setDupWarning(data.matches.map((m: any) => m.text));
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [text, slotId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/student/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        text,
        description,
        techStack: techStack
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        targetUsers,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setText('');
    setDescription('');
    setTechStack('');
    setTargetUsers('');
    onChange();
  }

  async function submitRepo(titleId: string) {
    const repoUrl = repoDrafts[titleId];
    if (!repoUrl) return;
    await fetch(`/api/student/titles/${titleId}/repo`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    });
    onChange();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card space-y-3">
        <p className="font-medium text-sm">Submit a project title</p>
        <div>
          <label className="label">Title</label>
          <input className="input" required value={text} onChange={(e) => setText(e.target.value)} />
          {dupWarning.length > 0 && (
            <p className="text-xs text-warn mt-1">
              Similar title{dupWarning.length > 1 ? 's' : ''} already exist: {dupWarning.join('; ')}
            </p>
          )}
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input h-24"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tech stack (comma separated)</label>
            <input
              className="input"
              placeholder="Next.js, PostgreSQL"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Target users</label>
            <input className="input" value={targetUsers} onChange={(e) => setTargetUsers(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary">
          Submit title
        </button>
      </form>

      {titles.length > 0 && (
        <div className="space-y-3">
          <p className="font-medium text-sm">Your submitted titles</p>
          {titles.map((t) => (
            <div key={t.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{t.text}</p>
                <span className={`badge ${STATUS_STYLES[t.status]}`}>{t.status}</span>
              </div>
              <p className="text-sm text-muted">{t.description}</p>
              {t.status === 'verified' && (
                <div className="pt-2 border-t border-line space-y-2">
                  {t.repoUrl ? (
                    <p className="text-sm">
                      Repo: <span className="text-accent">{t.repoUrl}</span>
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        className="input"
                        placeholder="https://github.com/..."
                        value={repoDrafts[t.id] || ''}
                        onChange={(e) => setRepoDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                      />
                      <button className="btn-secondary" onClick={() => submitRepo(t.id)}>
                        Save repo URL
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
