import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Project Submissions</h1>
          <p className="text-muted mt-2 text-sm">
            Manage project title submissions, verification, and grouping for your classes —
            no student accounts required.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/login" className="btn-primary w-full">
            Professor login
          </Link>
          <p className="text-xs text-muted">
            Students: use the class link your professor shared with you
            (looks like <code>/c/&lt;classId&gt;/login</code>).
          </p>
        </div>
      </div>
    </main>
  );
}
