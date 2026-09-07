import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================
// PROFESSORS
// ============================================================
export const professors = pgTable('professors', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});
// ============================================================
// PROFESSOR OTPS
// ============================================================
export const professorOtps = pgTable('professor_otps', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  otp: text('otp').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true })
    .notNull()
    .default(sql`(now() + interval '10 minutes')`),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// CLASSES
// ============================================================
export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  profId: uuid('prof_id')
    .notNull()
    .references(() => professors.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  term: text('term').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// PROJECT SLOTS
// ============================================================
export const projectSlots = pgTable('project_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  groupSize: integer('group_size').notNull().default(1),
  titlesRequiredMin: integer('titles_required_min').notNull().default(2),
  titlesAllowedMax: integer('titles_allowed_max').notNull().default(50),
  duplicateCheck: text('duplicate_check').notNull().default('warn'), // 'strict' | 'warn'
  deadline: timestamp('deadline', { withTimezone: true }),
  requireDeploymentUrl: boolean('require_deployment_url').notNull().default(false),
  requireTechStack: boolean('require_tech_stack').notNull().default(true),
  requireTargetUsers: boolean('require_target_users').notNull().default(false),
  locked: boolean('locked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// DOCUMENTATION FIELD TEMPLATES
// ============================================================
export const documentationFieldTemplates = pgTable(
  'documentation_field_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => projectSlots.id, { onDelete: 'cascade' }),
    fieldKey: text('field_key').notNull(),
    label: text('label').notNull(),
    fieldType: text('field_type').notNull().default('textarea'), // text | textarea | url | date
    required: boolean('required').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slotFieldKeyUnique: unique().on(t.slotId, t.fieldKey),
  })
);

// ============================================================
// STUDENTS
// ============================================================
export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    idNumber: text('id_number').notNull(),
    password: text('password').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    classIdNumberUnique: unique().on(t.classId, t.idNumber),
  })
);

// ============================================================
// GROUPS
// ============================================================
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => projectSlots.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('forming'), // 'forming' | 'locked'
  maxSize: integer('max_size').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// STUDENT <-> GROUP <-> SLOT
// ============================================================
export const studentGroupSlots = pgTable(
  'student_group_slots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => projectSlots.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    studentSlotUnique: unique().on(t.studentId, t.slotId),
  })
);

// ============================================================
// GROUP INVITES
// ============================================================
export const groupInvites = pgTable('group_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => projectSlots.id, { onDelete: 'cascade' }),
  invitedStudentId: uuid('invited_student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  invitedByStudentId: uuid('invited_by_student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'declined'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// GROUP LEAVE REQUESTS  (professor must confirm)
// ============================================================
export const groupLeaveRequests = pgTable('group_leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => projectSlots.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  status: text('status').notNull().default('pending'), // pending | approved | declined | cancelled
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedByProfId: uuid('resolved_by_prof_id').references(() => professors.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// TITLES
// ============================================================
export const titles = pgTable('titles', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => projectSlots.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  description: text('description').notNull(),
  techStack: text('tech_stack').array(),
  targetUsers: text('target_users'),
  status: text('status').notNull().default('pending'), // 'pending' | 'verified' | 'rejected'
  addedBy: text('added_by').notNull(), // 'student' | 'prof'
  submittedByStudentId: uuid('submitted_by_student_id').references(() => students.id, {
    onDelete: 'set null',
  }),
  addedByProfId: uuid('added_by_prof_id').references(() => professors.id, {
    onDelete: 'set null',
  }),
  repoUrl: text('repo_url'),
  deploymentUrl: text('deployment_url'),
  repoLastChecked: timestamp('repo_last_checked', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  progressStatus: text('progress_status').notNull().default('planning'), // planning | in_progress | review | done
  lastCommitSha: text('last_commit_sha'),
  lastCommitMessage: text('last_commit_message'),
  lastCommitAt: timestamp('last_commit_at', { withTimezone: true }),
  documentation: jsonb('documentation'), // flexible academic doc fields e.g. { abstract, statement_of_problem }
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByStudentId: uuid('updated_by_student_id').references(() => students.id, {
    onDelete: 'set null',
  }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================
// TASKS
// ============================================================
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  titleId: uuid('title_id')
    .notNull()
    .references(() => titles.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => projectSlots.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('planning'), // planning | in_progress | review | done
  assigneeStudentId: uuid('assignee_student_id').references(() => students.id, {
    onDelete: 'set null',
  }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================
// TITLE REPORTS  (version reports after a title is verified)
// ============================================================
export const titleReports = pgTable('title_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  titleId: uuid('title_id')
    .notNull()
    .references(() => titles.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => projectSlots.id, { onDelete: 'cascade' }),
  submittedByStudentId: uuid('submitted_by_student_id').references(() => students.id, {
    onDelete: 'set null',
  }),
  repoUrl: text('repo_url'),
  deploymentUrl: text('deployment_url'),
  version: text('version'),
  changelog: text('changelog'),
  progressSummary: text('progress_summary'),
  extraLinks: text('extra_links').array(),
  isEditable: boolean('is_editable').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================
// FEEDBACK  (professor / PM comments on titles and reports)
// ============================================================
export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id').references(() => projectSlots.id, { onDelete: 'cascade' }),
  titleId: uuid('title_id').references(() => titles.id, { onDelete: 'cascade' }),
  reportId: uuid('report_id').references(() => titleReports.id, { onDelete: 'set null' }),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
  givenByProfId: uuid('given_by_prof_id')
    .notNull()
    .references(() => professors.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // comment | request_changes | approval
  body: text('body').notNull(),
  status: text('status').notNull().default('open'), // open | resolved
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// RATE LIMITS
// ============================================================
export const rateLimits = pgTable('rate_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  action: text('action').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// PROJECT UPDATES  (progress notes + commit logs)
// ============================================================
export const projectUpdates = pgTable('project_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => projectSlots.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  titleId: uuid('title_id')
    .notNull()
    .references(() => titles.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  postedByStudentId: uuid('posted_by_student_id').references(() => students.id, {
    onDelete: 'set null',
  }),
  postedByProfId: uuid('posted_by_prof_id').references(() => professors.id, {
    onDelete: 'set null',
  }),
  kind: text('kind').notNull().default('progress'), // progress | commit | milestone | note
  headline: text('headline'),
  body: text('body').notNull(),
  changelog: text('changelog'),
  commitSha: text('commit_sha'),
  commitUrl: text('commit_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================
// ACTIVITY LOG
// ============================================================
export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').references(() => classes.id, { onDelete: 'set null' }),
  actorId: uuid('actor_id').notNull(),
  action: text('action').notNull(),
  targetId: uuid('target_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

