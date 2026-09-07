export type GroupStatus = 'forming' | 'locked';
export type TitleStatus = 'pending' | 'verified' | 'rejected';

export type Member = { id: string; name: string; idNumber: string };

export type Group = { id: string; status: GroupStatus; maxSize: number };

export type LeaveRequest = {
  id: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  reason: string | null;
  createdAt: string;
};

export type ProgressStatus = 'planning' | 'in_progress' | 'review' | 'done';

export type ProjectTitle = {
  id: string;
  slotId?: string;
  groupId?: string;
  text: string;
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  status: TitleStatus;
  repoUrl: string | null;
  deploymentUrl: string | null;
  rejectionReason?: string | null;
  progressStatus?: ProgressStatus | string | null;
  documentation?: Record<string, unknown> | null;
};

export type SlotInfo = {
  id: string;
  label: string;
  groupSize: number;
  titlesRequiredMin: number;
  titlesAllowedMax: number;
  duplicateCheck: 'strict' | 'warn';
  deadline: string | null;
  requireDeploymentUrl: boolean;
  requireTechStack: boolean;
  requireTargetUsers: boolean;
  locked: boolean;
};

export type VerifiedTitle = {
  id: string;
  text: string;
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  members: string[];
  repoUrl?: string | null;
  deploymentUrl?: string | null;
};

export type TaskItem = {
  id: string;
  titleId: string;
  groupId: string;
  classId: string;
  slotId: string;
  name: string;
  description: string | null;
  status: ProgressStatus;
  assigneeStudentId: string | null;
  assigneeName?: string | null;
  assigneeIdNumber?: string | null;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
};



