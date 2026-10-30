-- Apply before deploying the security fixes. No student/project records deleted.
BEGIN;
ALTER TABLE classes ALTER COLUMN default_student_password SET DEFAULT '2026';
CREATE INDEX IF NOT EXISTS rate_limits_bucket_created_idx ON rate_limits (key, action, created_at);
CREATE INDEX IF NOT EXISTS professor_otps_email_created_idx ON professor_otps (email, created_at);

-- Serialize all group, membership and invitation writers, including old routes.
CREATE OR REPLACE FUNCTION lock_project_slot_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_TABLE_NAME = 'project_slots' THEN
    PERFORM pg_advisory_xact_lock(hashtext(r.class_id::text || ':' || r.id::text));
    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1 FROM student_group_slots m JOIN groups g ON g.id = m.group_id
      WHERE g.slot_id = r.id GROUP BY g.id HAVING count(*) > r.group_size
    ) THEN RAISE EXCEPTION 'Existing group exceeds new slot capacity' USING ERRCODE = '23514'; END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(r.class_id::text || ':' || r.slot_id::text));
  END IF;
  IF TG_TABLE_NAME = 'groups' AND TG_OP = 'UPDATE' THEN
    IF (SELECT count(*) FROM student_group_slots WHERE group_id = r.id) > r.max_size
    THEN RAISE EXCEPTION 'Existing members exceed group capacity' USING ERRCODE = '23514'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS security_group_slot_lock ON groups;
CREATE TRIGGER security_group_slot_lock BEFORE INSERT OR UPDATE OR DELETE ON groups FOR EACH ROW EXECUTE FUNCTION lock_project_slot_change();
DROP TRIGGER IF EXISTS security_project_slot_lock ON project_slots;
CREATE TRIGGER security_project_slot_lock BEFORE UPDATE OR DELETE ON project_slots FOR EACH ROW EXECUTE FUNCTION lock_project_slot_change();
DROP TRIGGER IF EXISTS security_invite_slot_lock ON group_invites;
CREATE TRIGGER security_invite_slot_lock BEFORE INSERT OR UPDATE OR DELETE ON group_invites FOR EACH ROW EXECUTE FUNCTION lock_project_slot_change();
DROP TRIGGER IF EXISTS security_title_slot_lock ON titles;
CREATE TRIGGER security_title_slot_lock BEFORE INSERT OR UPDATE OR DELETE ON titles FOR EACH ROW EXECUTE FUNCTION lock_project_slot_change();

CREATE OR REPLACE FUNCTION enforce_group_membership_security() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g groups%ROWTYPE; student_class uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO g FROM groups WHERE id = OLD.group_id;
    IF FOUND THEN PERFORM pg_advisory_xact_lock(hashtext(g.class_id::text || ':' || g.slot_id::text)); END IF;
    RETURN OLD;
  END IF;
  SELECT * INTO g FROM groups WHERE id = NEW.group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found' USING ERRCODE = '23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(g.class_id::text || ':' || g.slot_id::text));
  SELECT * INTO g FROM groups WHERE id = NEW.group_id;
  SELECT class_id INTO student_class FROM students WHERE id = NEW.student_id AND is_active;
  IF student_class IS DISTINCT FROM g.class_id OR NEW.slot_id <> g.slot_id
    OR EXISTS (SELECT 1 FROM project_slots WHERE id = NEW.slot_id AND NEW.student_id = ANY(excluded_student_ids))
  THEN RAISE EXCEPTION 'Student is not eligible for this group' USING ERRCODE = '23514'; END IF;
  IF (SELECT count(*) FROM student_group_slots WHERE group_id = g.id AND id <> NEW.id) >= LEAST(g.max_size, (SELECT group_size FROM project_slots WHERE id = g.slot_id))
  THEN RAISE EXCEPTION 'Group is full' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS security_membership_guard ON student_group_slots;
CREATE TRIGGER security_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON student_group_slots FOR EACH ROW EXECUTE FUNCTION enforce_group_membership_security();

CREATE OR REPLACE FUNCTION enforce_invitation_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g groups%ROWTYPE;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  SELECT * INTO g FROM groups WHERE id = NEW.group_id;
  IF NOT FOUND OR g.class_id <> NEW.class_id OR g.slot_id <> NEW.slot_id THEN
    RAISE EXCEPTION 'Invalid invitation group' USING ERRCODE = '23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(g.class_id::text || ':' || g.slot_id::text));
  SELECT * INTO g FROM groups WHERE id = NEW.group_id;
  IF EXISTS (SELECT 1 FROM group_invites WHERE group_id = g.id AND invited_student_id = NEW.invited_student_id AND status = 'pending' AND id <> NEW.id)
    OR (SELECT count(*) FROM student_group_slots WHERE group_id = g.id) +
       (SELECT count(*) FROM group_invites WHERE group_id = g.id AND status = 'pending' AND id <> NEW.id) >= LEAST(g.max_size, (SELECT group_size FROM project_slots WHERE id = g.slot_id))
  THEN RAISE EXCEPTION 'No unreserved invitation seats remain' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS security_invitation_capacity ON group_invites;
CREATE TRIGGER security_invitation_capacity BEFORE INSERT OR UPDATE ON group_invites FOR EACH ROW EXECUTE FUNCTION enforce_invitation_capacity();

CREATE OR REPLACE FUNCTION accept_project_invite(p_invite_id uuid, p_student_id uuid, p_student_class uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE invitation group_invites%ROWTYPE; target_group groups%ROWTYPE; old_member student_group_slots%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM group_invites WHERE id = p_invite_id AND invited_student_id = p_student_id AND class_id = p_student_class;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Invitation not found'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_student_class::text || ':' || invitation.slot_id::text));
  SELECT * INTO invitation FROM group_invites WHERE id = p_invite_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Invitation already resolved'); END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND class_id = p_student_class AND is_active)
    OR NOT EXISTS (SELECT 1 FROM project_slots WHERE id = invitation.slot_id AND class_id = p_student_class AND NOT (p_student_id = ANY(excluded_student_ids)))
  THEN RETURN jsonb_build_object('error', 'Student is not enrolled'); END IF;
  SELECT * INTO target_group FROM groups WHERE id = invitation.group_id AND class_id = p_student_class AND slot_id = invitation.slot_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Group no longer exists'); END IF;
  IF (SELECT count(*) FROM student_group_slots WHERE group_id = target_group.id) >= target_group.max_size
  THEN RETURN jsonb_build_object('error', 'Group is full'); END IF;
  SELECT * INTO old_member FROM student_group_slots WHERE student_id = p_student_id AND slot_id = invitation.slot_id;
  IF FOUND THEN
    IF old_member.group_id = target_group.id
      OR (SELECT count(*) FROM student_group_slots WHERE group_id = old_member.group_id) <> 1
      OR EXISTS (SELECT 1 FROM titles WHERE group_id = old_member.group_id AND status = 'verified')
      OR EXISTS (SELECT 1 FROM group_invites WHERE group_id = old_member.group_id AND status = 'pending')
      OR EXISTS (SELECT 1 FROM group_leave_requests WHERE group_id = old_member.group_id AND status = 'pending')
    THEN RETURN jsonb_build_object('error', 'Only a solo draft group without pending changes can move'); END IF;
    UPDATE titles SET group_id = target_group.id, updated_at = now() WHERE group_id = old_member.group_id;
    UPDATE tasks SET group_id = target_group.id WHERE group_id = old_member.group_id;
    UPDATE project_updates SET group_id = target_group.id WHERE group_id = old_member.group_id;
    UPDATE title_reports SET group_id = target_group.id WHERE group_id = old_member.group_id;
    UPDATE feedback SET group_id = target_group.id WHERE group_id = old_member.group_id;
    DELETE FROM student_group_slots WHERE id = old_member.id;
    DELETE FROM groups WHERE id = old_member.group_id;
  END IF;
  INSERT INTO student_group_slots (student_id, group_id, slot_id) VALUES (p_student_id, target_group.id, invitation.slot_id);
  UPDATE group_invites SET status = CASE WHEN id = p_invite_id THEN 'accepted' ELSE 'declined' END
    WHERE invited_student_id = p_student_id AND slot_id = invitation.slot_id AND status = 'pending';
  UPDATE groups SET status = CASE WHEN (SELECT count(*) FROM student_group_slots WHERE group_id = target_group.id) >= max_size THEN 'locked' ELSE 'forming' END WHERE id = target_group.id;
  RETURN jsonb_build_object('ok', true, 'groupId', target_group.id);
END $$;
COMMIT;
