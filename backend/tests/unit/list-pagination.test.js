const mockModule = (path, exports) => {
    const resolved = require.resolve(path);
    require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
const query = vi.fn();
mockModule('../../src/config/db', { query });
mockModule('../../src/services/encryption.service', { hashPassword: vi.fn() });
const users = require('../../src/models/user.model');
const MedicalRecord = require('../../src/models/medical_record.model');
beforeEach(() => query.mockReset().mockResolvedValue({ rows: [{ count: '63' }] }));

test('user search is parameterized, tenant-scoped and bounded', async () => {
    await users.getAllUsers({ search: "O'Neil%", organizationId: 'hospital', role: 'doctor', limit: 10000, offset: -3 });
    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('ILIKE');
    expect(sql).not.toContain("O'Neil");
    expect(values).toContain('hospital');
    expect(values).toContain('doctor');
    expect(values).toContain("%O'Neil\\%%");
    expect(values.slice(-2)).toEqual([100, 0]);
});
test('user totals use the same search and access scope as the page', async () => {
    const options = { search: 'Casey', organizationId: 'hospital', status: 'inactive', limit: 20, offset: 40 };
    await users.getAllUsers(options);
    expect(await users.countAllUsers(options)).toBe(63);
    const [page, count] = query.mock.calls;
    expect(count[1]).toEqual(page[1].slice(0,-2));
    expect(count[0]).toContain('COUNT(DISTINCT u.id)');
    expect(count[0].slice(count[0].indexOf('FROM users'))).toBe(page[0].slice(page[0].indexOf('FROM users'),page[0].indexOf('ORDER BY')).trimEnd());
});
test('record search matches totals, including provider names, without fetching detail columns', async () => {
    await MedicalRecord.findByPatientId('patient', { search: 'Cardiology', type: 'consultation', summary: true, limit: 1000, offset: -5 });
    await MedicalRecord.countByPatient('patient', 'consultation', null, 'Cardiology');
    const [page, count] = query.mock.calls;
    expect(page[0]).toContain('ILIKE');
    expect(page[0]).toContain('mr.description');
    expect(page[0]).not.toContain('mr.*');
    expect(page[1]).toEqual(['patient', 'consultation', '%Cardiology%', 100, 0]);
    expect(count[1]).toEqual(page[1].slice(0,-2));
    expect(count[0]).toContain('u.first_name');
});
test('existing record consumers retain their default detail fields', async () => {
    await MedicalRecord.findByPatientId('patient', { visitId: 'visit', limit: 1 });
    expect(query.mock.calls[0][0]).toContain('mr.*');
    expect(query.mock.calls[0][1]).toEqual(['patient', 'visit', 1, 0]);
});
