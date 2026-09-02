import { db } from '@/lib/db';
import { classes } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { isUuid } from '@/lib/helpers';
import { LoginForm } from './login-form';

export default async function StudentLoginPage({ params }: { params: { classId: string } }) {
  let cls: { name: string; term: string } | undefined;
  if (isUuid(params.classId)) {
    const rows = await db
      .select({ name: classes.name, term: classes.term })
      .from(classes)
      .where(eq(classes.id, params.classId))
      .limit(1);
    cls = rows[0];
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <LoginForm classId={params.classId} className={cls?.name} term={cls?.term} />
    </main>
  );
}
