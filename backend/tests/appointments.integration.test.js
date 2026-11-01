const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withApplication } = require('./helpers/application-fixture');

test('appointments use configured clinic hours and enforce reservations across every write path', { skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000 }, async t => withApplication('appointments', async ({ db, people, organizations, call }) => {
    const date = (await db.query("SELECT to_char(CURRENT_DATE+7,'YYYY-MM-DD') AS day")).rows[0].day;
    const calendar = { doctorId: people.doctor.id, organizationId: organizations[0], timeZone: 'Asia/Kolkata', weekdays: [1,2,3,4,5,6,7], startTime: '09:00', endTime: '10:00', slotMinutes: 30 };
    const availability = `/appointments/availability?doctorId=${people.doctor.id}&organizationId=${organizations[0]}&date=${date}`;
    let slots; let booked;
    await t.test('unconfigured clinics advertise no invented slots and only the owning admin sets hours', async () => {
        assert.deepEqual((await call('patient', 'GET', availability)).data.slots, []);
        await call('otherAdmin', 'PUT', '/appointments/calendar', calendar, 403);
        await call('patient', 'PUT', '/appointments/calendar', calendar, 403);
        await call('admin', 'PUT', '/appointments/calendar', { ...calendar, timeZone: 'Invalid/Zone' }, 400);
        await call('admin', 'PUT', '/appointments/calendar', { ...calendar, doctorId: people.otherDoctor.id }, 403);
        await call('admin', 'PUT', '/appointments/calendar', calendar);
        const response = await call('patient', 'GET', availability);
        slots = response.data.slots;
        assert.equal(response.data.timeZone, 'Asia/Kolkata');
        assert.equal(slots.length, 2);
        assert.equal(slots[0].startsAt, `${date}T03:30:00.000Z`);
        assert.equal(slots[1].startsAt, `${date}T04:00:00.000Z`);
    });
    await t.test('simultaneous patients cannot reserve the same physician and time', async () => {
        const results = await Promise.all(['patient','otherPatient'].map(key => call(key, 'POST', '/visits/request', { hospitalCode: 'F00000', doctorId: people.doctor.id, scheduledTime: slots[0].startsAt, reason: 'Synthetic appointment' }, null)));
        assert.deepEqual(results.map(result => result.status).sort(), [201,409]);
        booked = results.find(result => result.status === 201).payload.data;
        assert.equal(new Date(booked.scheduled_time).toISOString(), slots[0].startsAt);
        assert.equal((await db.query('SELECT COUNT(*)::int count FROM appointment_reservations')).rows[0].count, 1);
        assert.equal((await call('patient', 'GET', availability)).data.slots.length, 1);
    });
    await t.test('invalid, past, and out-of-hours requests never create visits', async () => {
        for (const scheduledTime of ['not-a-date', '2000-01-01T03:30:00Z', `${date}T03:45:00Z`]) await call('patient', 'POST', '/visits/request', { hospitalCode: 'F00000', doctorId: people.doctor.id, scheduledTime }, 400);
        await call('patient', 'POST', '/visits/request', { hospitalCode: 'F00001', doctorId: people.doctor.id, scheduledTime: slots[1].startsAt }, 403);
        await call('patient', 'GET', availability.replace(date, '2026-02-30'), undefined, 400);
    });
    await t.test('rescheduling cannot overwrite occupied slots and cancellation releases a reservation', async () => {
        const second = (await call('patient', 'POST', '/visits/request', { hospitalCode: 'F00000', doctorId: people.doctor.id, scheduledTime: slots[1].startsAt }, 201)).data;
        await call('admin', 'PATCH', `/visits/${second.id}/scheduled-time`, { scheduledTime: slots[0].startsAt }, 409);
        assert.equal(new Date((await db.query('SELECT scheduled_time FROM visits WHERE id=$1',[second.id])).rows[0].scheduled_time).toISOString(), slots[1].startsAt);
        await db.query("UPDATE visits SET status='cancelled' WHERE id=$1", [booked.id]);
        assert.equal((await call('patient', 'GET', availability)).data.slots[0].startsAt, slots[0].startsAt);
    });
    await t.test('one physician cannot be double booked at different clinics', async () => {
        await db.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,(SELECT id FROM roles WHERE name='doctor'),'active')", [people.doctor.id,organizations[1]]);
        await call('otherAdmin','PUT','/appointments/calendar',{...calendar,organizationId:organizations[1]});
        await call('patient','POST','/visits/request',{hospitalCode:'F00000',doctorId:people.doctor.id,scheduledTime:slots[0].startsAt},201);
        await call('otherPatient','POST','/visits/request',{hospitalCode:'F00001',doctorId:people.doctor.id,scheduledTime:slots[0].startsAt},409);
    });
}));
