CREATE SCHEMA "public";
CREATE SCHEMA "neon_auth";
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"prof_id" uuid NOT NULL,
	"name" text NOT NULL,
	"term" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "group_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"invited_student_id" uuid NOT NULL,
	"invited_by_student_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_invites_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);
CREATE TABLE "group_leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"group_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_prof_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_leave_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])))
);
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"status" text DEFAULT 'forming' NOT NULL,
	"max_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_status_check" CHECK ((status = ANY (ARRAY['forming'::text, 'locked'::text])))
);
CREATE TABLE "professor_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"otp" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "professors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL CONSTRAINT "professors_email_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
CREATE TABLE "project_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL,
	"label" text NOT NULL,
	"group_size" integer DEFAULT 1 NOT NULL,
	"titles_required_min" integer DEFAULT 2 NOT NULL,
	"titles_allowed_max" integer DEFAULT 50 NOT NULL,
	"duplicate_check" text DEFAULT 'warn' NOT NULL,
	"deadline" timestamp with time zone,
	"require_deployment_url" boolean DEFAULT false NOT NULL,
	"require_tech_stack" boolean DEFAULT true NOT NULL,
	"require_target_users" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_slots_duplicate_check_check" CHECK ((duplicate_check = ANY (ARRAY['strict'::text, 'warn'::text])))
);
CREATE TABLE "project_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"title_id" uuid NOT NULL,
	"posted_by_student_id" uuid,
	"posted_by_prof_id" uuid,
	"kind" text DEFAULT 'progress' NOT NULL,
	"headline" text,
	"body" text NOT NULL,
	"commit_sha" text,
	"commit_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_updates_kind_check" CHECK ((kind = ANY (ARRAY['progress'::text, 'commit'::text, 'milestone'::text, 'note'::text])))
);
CREATE TABLE "student_group_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	CONSTRAINT "student_group_slots_student_id_slot_id_key" UNIQUE("student_id","slot_id")
);
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"id_number" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "students_class_id_id_number_key" UNIQUE("class_id","id_number")
);
CREATE TABLE "titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"class_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"text" text NOT NULL,
	"description" text NOT NULL,
	"tech_stack" text[],
	"target_users" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"added_by" text NOT NULL,
	"submitted_by_student_id" uuid,
	"added_by_prof_id" uuid,
	"repo_url" text,
	"deployment_url" text,
	"repo_last_checked" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_student_id" uuid,
	"rejection_reason" text,
	"progress_status" text DEFAULT 'planning' NOT NULL,
	"last_commit_sha" text,
	"last_commit_message" text,
	"last_commit_at" timestamp with time zone,
	CONSTRAINT "titles_added_by_check" CHECK ((added_by = ANY (ARRAY['student'::text, 'prof'::text]))),
	CONSTRAINT "titles_progress_status_check" CHECK ((progress_status = ANY (ARRAY['planning'::text, 'in_progress'::text, 'review'::text, 'done'::text]))),
	CONSTRAINT "titles_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])))
);
CREATE TABLE "neon_auth"."account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" uuid NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
CREATE TABLE "neon_auth"."invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organizationId" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"inviterId" uuid NOT NULL
);
CREATE TABLE "neon_auth"."jwks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"publicKey" text NOT NULL,
	"privateKey" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"expiresAt" timestamp with time zone
);
CREATE TABLE "neon_auth"."member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organizationId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" text NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
CREATE TABLE "neon_auth"."organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"slug" text NOT NULL CONSTRAINT "organization_slug_key" UNIQUE,
	"logo" text,
	"createdAt" timestamp with time zone NOT NULL,
	"metadata" text
);
CREATE TABLE "neon_auth"."project_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"endpoint_id" text NOT NULL CONSTRAINT "project_config_endpoint_id_key" UNIQUE,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"trusted_origins" jsonb NOT NULL,
	"social_providers" jsonb NOT NULL,
	"email_provider" jsonb,
	"email_and_password" jsonb,
	"allow_localhost" boolean NOT NULL,
	"plugin_configs" jsonb,
	"webhook_config" jsonb
);
CREATE TABLE "neon_auth"."session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"expiresAt" timestamp with time zone NOT NULL,
	"token" text NOT NULL CONSTRAINT "session_token_key" UNIQUE,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" uuid NOT NULL,
	"impersonatedBy" text,
	"activeOrganizationId" text
);
CREATE TABLE "neon_auth"."user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"email" text NOT NULL CONSTRAINT "user_email_key" UNIQUE,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"role" text,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp with time zone
);
CREATE TABLE "neon_auth"."verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX "activity_log_pkey" ON "activity_log" ("id");
CREATE INDEX "idx_activity_class" ON "activity_log" ("class_id","created_at");
CREATE UNIQUE INDEX "classes_pkey" ON "classes" ("id");
CREATE INDEX "idx_classes_prof_id" ON "classes" ("prof_id");
CREATE UNIQUE INDEX "group_invites_pkey" ON "group_invites" ("id");
CREATE INDEX "idx_invites_invited_student" ON "group_invites" ("invited_student_id","slot_id");
CREATE UNIQUE INDEX "group_leave_requests_pkey" ON "group_leave_requests" ("id");
CREATE INDEX "idx_leave_requests_class_status" ON "group_leave_requests" ("class_id","status","created_at");
CREATE UNIQUE INDEX "idx_leave_requests_one_pending" ON "group_leave_requests" ("student_id","group_id");
CREATE UNIQUE INDEX "groups_pkey" ON "groups" ("id");
CREATE INDEX "idx_groups_class_slot" ON "groups" ("class_id","slot_id");
CREATE INDEX "idx_otps_email" ON "professor_otps" ("email");
CREATE INDEX "idx_otps_expires_at" ON "professor_otps" ("expires_at");
CREATE UNIQUE INDEX "professor_otps_pkey" ON "professor_otps" ("id");
CREATE UNIQUE INDEX "professors_email_key" ON "professors" ("email");
CREATE UNIQUE INDEX "professors_pkey" ON "professors" ("id");
CREATE INDEX "idx_project_slots_class_id" ON "project_slots" ("class_id");
CREATE UNIQUE INDEX "project_slots_pkey" ON "project_slots" ("id");
CREATE INDEX "idx_project_updates_class" ON "project_updates" ("class_id","created_at");
CREATE INDEX "idx_project_updates_title" ON "project_updates" ("title_id","created_at");
CREATE UNIQUE INDEX "project_updates_pkey" ON "project_updates" ("id");
CREATE INDEX "idx_sgs_student_slot" ON "student_group_slots" ("student_id","slot_id");
CREATE UNIQUE INDEX "student_group_slots_pkey" ON "student_group_slots" ("id");
CREATE UNIQUE INDEX "student_group_slots_student_id_slot_id_key" ON "student_group_slots" ("student_id","slot_id");
CREATE INDEX "idx_students_class_id" ON "students" ("class_id");
CREATE UNIQUE INDEX "students_class_id_id_number_key" ON "students" ("class_id","id_number");
CREATE UNIQUE INDEX "students_pkey" ON "students" ("id");
CREATE INDEX "idx_titles_group_slot" ON "titles" ("group_id","slot_id");
CREATE INDEX "idx_titles_status" ON "titles" ("class_id","slot_id","status");
CREATE UNIQUE INDEX "titles_pkey" ON "titles" ("id");
CREATE UNIQUE INDEX "account_pkey" ON "neon_auth"."account" ("id");
CREATE INDEX "account_userId_idx" ON "neon_auth"."account" ("userId");
CREATE INDEX "invitation_email_idx" ON "neon_auth"."invitation" ("email");
CREATE INDEX "invitation_organizationId_idx" ON "neon_auth"."invitation" ("organizationId");
CREATE UNIQUE INDEX "invitation_pkey" ON "neon_auth"."invitation" ("id");
CREATE UNIQUE INDEX "jwks_pkey" ON "neon_auth"."jwks" ("id");
CREATE INDEX "member_organizationId_idx" ON "neon_auth"."member" ("organizationId");
CREATE UNIQUE INDEX "member_pkey" ON "neon_auth"."member" ("id");
CREATE INDEX "member_userId_idx" ON "neon_auth"."member" ("userId");
CREATE UNIQUE INDEX "organization_pkey" ON "neon_auth"."organization" ("id");
CREATE UNIQUE INDEX "organization_slug_key" ON "neon_auth"."organization" ("slug");
CREATE UNIQUE INDEX "organization_slug_uidx" ON "neon_auth"."organization" ("slug");
CREATE UNIQUE INDEX "project_config_endpoint_id_key" ON "neon_auth"."project_config" ("endpoint_id");
CREATE UNIQUE INDEX "project_config_pkey" ON "neon_auth"."project_config" ("id");
CREATE UNIQUE INDEX "session_pkey" ON "neon_auth"."session" ("id");
CREATE UNIQUE INDEX "session_token_key" ON "neon_auth"."session" ("token");
CREATE INDEX "session_userId_idx" ON "neon_auth"."session" ("userId");
CREATE UNIQUE INDEX "user_email_key" ON "neon_auth"."user" ("email");
CREATE UNIQUE INDEX "user_pkey" ON "neon_auth"."user" ("id");
CREATE INDEX "verification_identifier_idx" ON "neon_auth"."verification" ("identifier");
CREATE UNIQUE INDEX "verification_pkey" ON "neon_auth"."verification" ("id");
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL;
ALTER TABLE "classes" ADD CONSTRAINT "classes_prof_id_fkey" FOREIGN KEY ("prof_id") REFERENCES "professors"("id") ON DELETE CASCADE;
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invited_by_student_id_fkey" FOREIGN KEY ("invited_by_student_id") REFERENCES "students"("id") ON DELETE CASCADE;
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_invited_student_id_fkey" FOREIGN KEY ("invited_student_id") REFERENCES "students"("id") ON DELETE CASCADE;
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "project_slots"("id") ON DELETE CASCADE;
ALTER TABLE "group_leave_requests" ADD CONSTRAINT "group_leave_requests_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "group_leave_requests" ADD CONSTRAINT "group_leave_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;
ALTER TABLE "group_leave_requests" ADD CONSTRAINT "group_leave_requests_resolved_by_prof_id_fkey" FOREIGN KEY ("resolved_by_prof_id") REFERENCES "professors"("id") ON DELETE SET NULL;
ALTER TABLE "group_leave_requests" ADD CONSTRAINT "group_leave_requests_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "project_slots"("id") ON DELETE CASCADE;
ALTER TABLE "group_leave_requests" ADD CONSTRAINT "group_leave_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "project_slots"("id") ON DELETE CASCADE;
ALTER TABLE "project_slots" ADD CONSTRAINT "project_slots_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_posted_by_prof_id_fkey" FOREIGN KEY ("posted_by_prof_id") REFERENCES "professors"("id") ON DELETE SET NULL;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_posted_by_student_id_fkey" FOREIGN KEY ("posted_by_student_id") REFERENCES "students"("id") ON DELETE SET NULL;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "project_slots"("id") ON DELETE CASCADE;
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE;
ALTER TABLE "student_group_slots" ADD CONSTRAINT "student_group_slots_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;
ALTER TABLE "student_group_slots" ADD CONSTRAINT "student_group_slots_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "project_slots"("id") ON DELETE CASCADE;
ALTER TABLE "student_group_slots" ADD CONSTRAINT "student_group_slots_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_added_by_prof_id_fkey" FOREIGN KEY ("added_by_prof_id") REFERENCES "professors"("id") ON DELETE SET NULL;
ALTER TABLE "titles" ADD CONSTRAINT "titles_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "project_slots"("id") ON DELETE CASCADE;
ALTER TABLE "titles" ADD CONSTRAINT "titles_submitted_by_student_id_fkey" FOREIGN KEY ("submitted_by_student_id") REFERENCES "students"("id") ON DELETE SET NULL;
ALTER TABLE "titles" ADD CONSTRAINT "titles_updated_by_student_id_fkey" FOREIGN KEY ("updated_by_student_id") REFERENCES "students"("id") ON DELETE SET NULL;
ALTER TABLE "neon_auth"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "neon_auth"."organization"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "neon_auth"."organization"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;
ALTER TABLE "neon_auth"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "neon_auth"."user"("id") ON DELETE CASCADE;