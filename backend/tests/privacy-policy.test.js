const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { calendarMonthDue } = require('../src/modules/privacy/privacy-rights.service');

for (const [received, expected] of [
    ['2025-01-31T13:24:12.000Z', '2025-02-28T13:24:12.000Z'],
    ['2024-01-31T13:24:12.000Z', '2024-02-29T13:24:12.000Z'],
    ['2026-12-15T00:00:00.000Z', '2027-01-15T00:00:00.000Z'],
    ['2026-03-31T00:00:00.000Z', '2026-04-30T00:00:00.000Z'],
]) test(`calendar-month review date clamps ${received}`, () => {
    assert.equal(calendarMonthDue(new Date(received)).toISOString(), expected);
});
after(async () => { await require('../src/config/db').pool.end(); require('../src/utils/logger').close(); });
