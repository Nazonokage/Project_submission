import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  unique,
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
});

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByStudentId: uuid('updated_by_student_id').references(() => students.id, {
    onDelete: 'set null',
  }),
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
