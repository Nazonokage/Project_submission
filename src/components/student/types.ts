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
  text: string;
  description: string;
  techStack: string[] | null;
  targetUsers: string | null;
  status: TitleStatus;
  repoUrl: string | null;
  deploymentUrl: string | null;
  rejectionReason?: string | null;
  progressStatus?: ProgressStatus | string | null;
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
