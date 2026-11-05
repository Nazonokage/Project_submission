import type { NextRequest } from 'next/server';
import { deleteTask, updateTask } from '@/lib/task-mutations';

type Context = { params: Promise<{ taskId: string }> };

export function PATCH(req: NextRequest, context: Context) {
  return updateTask(req, context, 'student');
}

export function DELETE(req: NextRequest, context: Context) {
  return deleteTask(req, context, 'student');
}
