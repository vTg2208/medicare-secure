-- Durable in-app delivery participates in the event transaction, including
-- emergency activation and breach reports. Never copy patient narratives.
CREATE UNIQUE INDEX unique_security_event_notification ON notifications(user_id,related_entity_id)
WHERE type='security_alert';
CREATE FUNCTION notify_security_responders() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.severity IN ('high','critical') THEN
        INSERT INTO notifications(user_id,type,title,message,priority,channels,related_entity_type,related_entity_id,metadata)
        SELECT u.id,'security_alert','Security incident requires review',
          'A security incident requires review in the compliance incident queue.',NEW.severity,
          '["in_app"]'::jsonb,'security_event',NEW.id,jsonb_build_object('incidentId',NEW.id)
        FROM users u JOIN roles r ON r.id=u.role_id
        WHERE u.status='active' AND r.name IN ('compliance_officer','system_admin')
        ON CONFLICT (user_id,related_entity_id) WHERE type='security_alert' DO NOTHING;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER security_responder_alert AFTER INSERT OR UPDATE OF severity ON security_events
FOR EACH ROW EXECUTE FUNCTION notify_security_responders();
