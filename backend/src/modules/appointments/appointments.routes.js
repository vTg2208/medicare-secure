const router = require('express').Router();
const db = require('../../config/db');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { canManageOrganization } = require('../../middleware/clinical-access.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
router.use(authenticate);
const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const uuid = value => { if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value || '')) throw fault(400, 'Select a doctor and clinic'); return value; };
const identity = body => [uuid(body.organizationId), uuid(body.doctorId)];
const assertDoctor = async values => {
    const doctor = await db.query(`SELECT s.user_id FROM staff_org_mapping s JOIN users u ON u.id=s.user_id
        JOIN roles r ON r.id=u.role_id JOIN organizations o ON o.id=s.organization_id
        WHERE s.organization_id=$1 AND s.user_id=$2 AND s.status='active' AND r.name='doctor' AND u.status='active'
        AND COALESCE(u.account_status,'active')='active' AND o.status='active' AND o.verified=true`, values);
    if (!doctor.rowCount) throw fault(403, 'Doctor is not active in the selected clinic');
};
router.get('/availability', asyncHandler(async (req, res) => {
    const values = identity(req.query);
    const date = req.query.date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw fault(400, 'Choose a valid clinic date');
    const dayDistance = (Date.parse(date) - Date.now()) / 86400000;
    if (dayDistance < -2 || dayDistance > 366) throw fault(400, 'Choose a clinic date within the coming year');
    await assertDoctor(values);
    const calendar = (await db.query('SELECT time_zone FROM appointment_calendars WHERE organization_id=$1 AND doctor_id=$2', values)).rows[0];
    if (!calendar) return res.json({ success: true, data: { timeZone: null, slots: [] } });
    const result = await db.query(`SELECT slot AS "startsAt",slot+make_interval(mins=>c.slot_minutes) AS "endsAt"
        FROM appointment_calendars c CROSS JOIN LATERAL generate_series(
            ($3::date+c.start_time) AT TIME ZONE c.time_zone,
            ($3::date+c.end_time) AT TIME ZONE c.time_zone-make_interval(mins=>c.slot_minutes),make_interval(mins=>c.slot_minutes)) slot
        WHERE c.organization_id=$1 AND c.doctor_id=$2 AND extract(isodow FROM $3::date)::integer=ANY(c.weekdays) AND slot>NOW()
        AND NOT EXISTS(SELECT 1 FROM appointment_reservations a WHERE a.doctor_id=c.doctor_id
            AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(slot,slot+make_interval(mins=>c.slot_minutes),'[)'))
        AND NOT EXISTS(SELECT 1 FROM visits v WHERE v.assigned_doctor_id=c.doctor_id AND v.scheduled_time IS NOT NULL
            AND v.status NOT IN ('completed','cancelled','no_show') AND NOT EXISTS(SELECT 1 FROM appointment_reservations a WHERE a.visit_id=v.id)
            AND tstzrange(v.scheduled_time,v.scheduled_time+INTERVAL '30 minutes','[)') && tstzrange(slot,slot+make_interval(mins=>c.slot_minutes),'[)'))
        ORDER BY slot`, [...values, date]);
    res.json({ success: true, data: { timeZone: calendar.time_zone, slots: result.rows } });
}));
router.get('/calendar', authorize(['hospital_admin','system_admin']), asyncHandler(async (req,res) => {
    const values = identity(req.query);
    if (!await canManageOrganization(req.user, values[0])) throw fault(403, 'Clinic administration access required');
    res.json({success:true,data:(await db.query('SELECT time_zone,weekdays,start_time,end_time,slot_minutes FROM appointment_calendars WHERE organization_id=$1 AND doctor_id=$2',values)).rows[0] || null});
}));
router.put('/calendar', authorize(['hospital_admin','system_admin']), asyncHandler(async (req, res) => {
    const { timeZone, weekdays, startTime, endTime, slotMinutes } = req.body;
    const values = identity(req.body);
    if (!await canManageOrganization(req.user, values[0])) throw fault(403, 'Clinic administration access required');
    await assertDoctor(values);
    if (typeof timeZone !== 'string' || !(await db.query('SELECT 1 FROM pg_timezone_names WHERE name=$1',[timeZone])).rowCount
        || !Array.isArray(weekdays) || !weekdays.length || weekdays.some(day => !Number.isInteger(day) || day<1 || day>7)
        || ![15,30,60].includes(slotMinutes) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime || '') || startTime>=endTime) throw fault(400,'Provide valid clinic hours, weekdays, time zone and slot duration');
    const row = (await db.query(`INSERT INTO appointment_calendars(organization_id,doctor_id,time_zone,weekdays,start_time,end_time,slot_minutes)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,doctor_id) DO UPDATE SET time_zone=EXCLUDED.time_zone,weekdays=EXCLUDED.weekdays,
        start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,slot_minutes=EXCLUDED.slot_minutes RETURNING *`,[...values,timeZone,[...new Set(weekdays)],startTime,endTime,slotMinutes])).rows[0];
    res.json({success:true,data:row});
}));
module.exports = router;
