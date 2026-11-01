CREATE EXTENSION IF NOT EXISTS btree_gist;
-- Historical timestamp values were stored by the API as UTC instants.
ALTER TABLE visits ALTER COLUMN scheduled_time TYPE TIMESTAMPTZ USING scheduled_time AT TIME ZONE 'UTC';
CREATE TABLE appointment_calendars (
    organization_id UUID NOT NULL REFERENCES organizations(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    time_zone TEXT NOT NULL,
    weekdays INTEGER[] NOT NULL CHECK (cardinality(weekdays)>0 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL CHECK (end_time>start_time),
    slot_minutes INTEGER NOT NULL CHECK (slot_minutes IN (15,30,60)),
    PRIMARY KEY (organization_id,doctor_id)
);
CREATE TABLE appointment_reservations (
    visit_id UUID PRIMARY KEY REFERENCES visits(id),
    doctor_id UUID NOT NULL REFERENCES users(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at>starts_at),
    EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
);
-- Existing scheduled visits remain intact. Availability treats those legacy
-- appointments as 30-minute reservations until explicitly rescheduled.
CREATE FUNCTION maintain_appointment_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE calendar appointment_calendars%ROWTYPE; local_day DATE; valid_slot BOOLEAN;
BEGIN
    IF NEW.status IN ('completed','cancelled','no_show') OR NEW.scheduled_time IS NULL OR NEW.assigned_doctor_id IS NULL THEN
        DELETE FROM appointment_reservations WHERE visit_id=NEW.id;
        RETURN NULL;
    END IF;
    IF TG_OP='UPDATE' AND OLD.status NOT IN ('completed','cancelled','no_show')
        AND OLD.scheduled_time IS NOT DISTINCT FROM NEW.scheduled_time
        AND OLD.assigned_doctor_id IS NOT DISTINCT FROM NEW.assigned_doctor_id
        AND OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id THEN RETURN NULL; END IF;
    SELECT c.* INTO calendar FROM appointment_calendars c
        JOIN staff_org_mapping s ON s.user_id=c.doctor_id AND s.organization_id=c.organization_id AND s.status='active'
        JOIN users u ON u.id=c.doctor_id JOIN roles r ON r.id=u.role_id
        JOIN organizations o ON o.id=c.organization_id
        WHERE c.organization_id=NEW.organization_id AND c.doctor_id=NEW.assigned_doctor_id
        AND u.status='active' AND COALESCE(u.account_status,'active')='active' AND r.name='doctor' AND o.status='active' AND o.verified=true;
    IF NOT FOUND THEN RAISE EXCEPTION 'An active doctor calendar in this clinic is required' USING ERRCODE='23514'; END IF;
    local_day := (NEW.scheduled_time AT TIME ZONE calendar.time_zone)::date;
    SELECT EXISTS(SELECT 1 FROM generate_series(
        (local_day+calendar.start_time) AT TIME ZONE calendar.time_zone,
        (local_day+calendar.end_time) AT TIME ZONE calendar.time_zone-make_interval(mins=>calendar.slot_minutes),
        make_interval(mins=>calendar.slot_minutes)) slot
        WHERE slot=NEW.scheduled_time AND slot>NOW() AND extract(isodow FROM local_day)::integer=ANY(calendar.weekdays)) INTO valid_slot;
    IF NOT valid_slot THEN RAISE EXCEPTION 'Choose a future available appointment from the clinic calendar' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM visits v WHERE v.id<>NEW.id AND v.assigned_doctor_id=NEW.assigned_doctor_id
        AND v.status NOT IN ('completed','cancelled','no_show') AND v.scheduled_time IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM appointment_reservations existing WHERE existing.visit_id=v.id)
        AND tstzrange(v.scheduled_time,v.scheduled_time+INTERVAL '30 minutes','[)') &&
            tstzrange(NEW.scheduled_time,NEW.scheduled_time+make_interval(mins=>calendar.slot_minutes),'[)')) THEN
        RAISE EXCEPTION 'This appointment is already reserved' USING ERRCODE='23P01';
    END IF;
    INSERT INTO appointment_reservations(visit_id,doctor_id,starts_at,ends_at)
        VALUES(NEW.id,NEW.assigned_doctor_id,NEW.scheduled_time,NEW.scheduled_time+make_interval(mins=>calendar.slot_minutes))
        ON CONFLICT(visit_id) DO UPDATE SET doctor_id=EXCLUDED.doctor_id,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at;
    RETURN NULL;
END $$;
CREATE TRIGGER maintain_appointment_reservation AFTER INSERT OR UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION maintain_appointment_reservation();
DO $migration$
BEGIN EXECUTE format('ALTER FUNCTION %I.maintain_appointment_reservation() SET search_path=pg_catalog,%I,pg_temp',current_schema(),current_schema()); END $migration$;
