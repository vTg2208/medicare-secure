# Appointment calendars and reservations

Hospital administrators publish a doctor's recurring hours at `/admin/appointment-calendars`. Select the doctor's actual clinic, an IANA time zone, weekdays, start/end times and a 15-, 30- or 60-minute duration. An unconfigured calendar advertises no slots. Existing appointments remain reserved after calendar edits.

Patients select server-provided availability through the existing visit scheduling form. The selected ISO instant is included in the visit request; choosing a slot alone does not reserve it. Successful submission reserves it while clinic approval and patient consent remain separate workflows. Conflicting submissions return HTTP 409 and must select another slot.

Migration 027 converts the old timezone-less `visits.scheduled_time` column to `TIMESTAMPTZ`, interpreting historical API values as UTC. An operator must confirm that assumption for imported legacy appointments before migrating a real installation. The application never migrates a hosted database automatically.

New and rescheduled appointments use PostgreSQL range-exclusion reservations. They cannot overlap for the same physician, including across clinics. A database trigger covers booking, reassignment, rescheduling and cancellation paths. Completed, cancelled and no-show visits release their reservation. Legacy scheduled visits are preserved and conservatively block 30 minutes until explicitly rescheduled; they are not silently dropped or rewritten as new bookings.

Availability returns times and the clinic time zone, never patient names or booking details. Calendar administration follows the hospital boundary. Integration tests use disposable PostgreSQL and synthetic principals to exercise concurrent booking, invalid dates, clinic boundaries, rescheduling conflicts, cancellation and private-schema upgrades.
