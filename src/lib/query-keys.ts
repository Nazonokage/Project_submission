export const boardKeys = {
  title: (role: 'student' | 'prof', titleId: string) => ['board', role, 'title', titleId] as const,
  tasks: (role: 'student' | 'prof', titleId: string) => [...boardKeys.title(role, titleId), 'tasks'] as const,
  updates: (role: 'student' | 'prof', titleId: string) => [...boardKeys.title(role, titleId), 'updates'] as const,
  feedback: (role: 'student' | 'prof', titleId: string) => [...boardKeys.title(role, titleId), 'feedback'] as const,
  snapshot: (role: 'student' | 'prof', titleId: string) => [...boardKeys.title(role, titleId), 'snapshot'] as const,
  slot: (classId: string, slotId: string) => ['board', 'prof', 'class', classId, 'slot', slotId] as const,
};
