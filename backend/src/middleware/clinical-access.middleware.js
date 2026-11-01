const { query } = require('../config/db');
const { findMatchingConsent } = require('../models/consent.model');
const { processingAllowedSql, purposeForCategory } = require('../modules/privacy/processing-policy');
const fs = require('fs/promises');
const { consentCategories, consentPurposeSql } = require('../utils/consent.validator');

const PROVIDERS = ['doctor', 'nurse', 'lab_technician', 'radiologist', 'pharmacist'];
const RECORD_CATEGORIES = { diagnosis: 'diagnoses', prescription: 'prescriptions', lab_result: 'lab_results', lab_order: 'lab_results', lab_request: 'lab_results', laboratory: 'lab_results', lab: 'lab_results', imaging: 'imaging', vitals: 'vitals', consultation: 'clinical_notes', note: 'clinical_notes', treatment: 'clinical_notes', procedure: 'clinical_notes', other: 'clinical_notes', vaccination: 'clinical_notes' };
const STAFF_ROLES = ['doctor', 'nurse', 'lab_technician', 'radiologist', 'pharmacist', 'receptionist'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const activeStates = "('checked_in', 'in_progress', 'active')";
const roleOf = req => req.user?.roleName;
const fail = async (req, res, status, message) => {
    // Multipart uploads are temporary until the resource guard authorizes them.
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    return res.status(status).json({ success: false, message });
};
const fault = (status, message) => Object.assign(new Error(message), { status });
const validId = id => { if (typeof id !== 'string' || !UUID.test(id)) throw fault(400, 'A valid resource identifier is required'); return id; };

// SQL expressions are internal constants, never request values. All principals use bind parameters.
const consentSql = (patient, user, category = 'all', access = 'read') => `${processingAllowedSql(patient,purposeForCategory(category))} AND EXISTS (
    SELECT 1 FROM consents access_consent
    WHERE access_consent.patient_id = ${patient} AND access_consent.recipient_user_id = ${user}
      AND access_consent.status = 'active' AND access_consent.start_time <= NOW()
      AND (access_consent.end_time IS NULL OR access_consent.end_time > NOW())
      AND access_consent.data_category IN ('all', 'all_medical_data', '*', ${consentCategories(category).map(value => `'${value}'`).join(',')})
      AND access_consent.access_level IN (${access === 'write' ? "'write'" : "'read', 'write'"})
      AND ${consentPurposeSql('access_consent', category)}
)`;
const organizationSql = (organization, user) => `EXISTS (
    SELECT 1 FROM staff_org_mapping access_mapping
    WHERE access_mapping.organization_id = ${organization} AND access_mapping.user_id = ${user}
      AND access_mapping.status = 'active'
)`;
const assignmentSql = (visit, user) => `(NOT EXISTS (SELECT 1 FROM visit_staff_assignments denied_assignment WHERE denied_assignment.visit_id=${visit}.id AND denied_assignment.staff_user_id=${user} AND (denied_assignment.revoked_at IS NOT NULL OR denied_assignment.access_level='revoked')) AND (${visit}.assigned_doctor_id = ${user} OR ${visit}.assigned_nurse_id = ${user}
    OR EXISTS (SELECT 1 FROM visit_staff_assignments access_assignment WHERE access_assignment.visit_id = ${visit}.id AND access_assignment.staff_user_id = ${user} AND access_assignment.revoked_at IS NULL AND access_assignment.access_level<>'revoked')
    OR EXISTS (SELECT 1 FROM care_team_assignments access_team WHERE access_team.visit_id = ${visit}.id AND access_team.staff_user_id = ${user} AND access_team.removed_at IS NULL)))`;
const clinicalScopeSql = (patient, visit, user, role, category = 'all', access = 'read') => `${consentSql(patient, user, category, access)} AND EXISTS (
    SELECT 1 FROM visits access_visit
    WHERE access_visit.patient_id = ${patient} ${visit ? `AND access_visit.id = ${visit}` : ''}
      AND access_visit.status IN ${activeStates}
      AND ${organizationSql('access_visit.organization_id', user)}
      ${['doctor', 'nurse'].includes(role) ? `AND ${assignmentSql('access_visit', user)}` : ''}
)`;

const resourceQueries = {
    visit: 'SELECT id AS visit_id, id, patient_id, organization_id, status FROM visits WHERE id = $1',
    record: 'SELECT id AS record_id, patient_id, visit_id, type FROM medical_records WHERE id = $1',
    diagnosis: 'SELECT mr.patient_id, mr.visit_id, mr.id AS record_id FROM diagnoses item JOIN medical_records mr ON item.record_id = mr.id WHERE item.id = $1',
    prescription: 'SELECT mr.patient_id, mr.visit_id, mr.id AS record_id FROM prescriptions item JOIN medical_records mr ON item.record_id = mr.id WHERE item.id = $1',
    labOrder: 'SELECT v.patient_id, v.id AS visit_id, v.organization_id FROM lab_orders item JOIN visits v ON item.visit_id = v.id WHERE item.id = $1',
    imagingOrder: 'SELECT v.patient_id, v.id AS visit_id, v.organization_id FROM imaging_orders item JOIN visits v ON item.visit_id = v.id WHERE item.id = $1',
    medicationOrder: 'SELECT v.patient_id, v.id AS visit_id, v.organization_id FROM medication_orders item JOIN visits v ON item.visit_id = v.id WHERE item.id = $1',
    labResult: 'SELECT mr.patient_id, mr.visit_id, mr.id AS record_id FROM lab_results item JOIN medical_records mr ON item.record_id = mr.id WHERE item.id = $1',
    imagingReport: 'SELECT mr.patient_id, mr.visit_id, mr.id AS record_id FROM imaging_reports item JOIN medical_records mr ON item.record_id = mr.id WHERE item.id = $1',
    careTeam: 'SELECT v.patient_id, v.id AS visit_id, v.organization_id FROM care_team_assignments item JOIN visits v ON item.visit_id = v.id WHERE item.id = $1',
    bed: 'SELECT v.patient_id, v.id AS visit_id, v.organization_id FROM bed_allocations item JOIN visits v ON item.visit_id = v.id WHERE item.id = $1',
};
const resolveResource = async (resource, id) => {
    validId(id);
    if (resource === 'patient') return { patient_id: id };
    if (!resourceQueries[resource]) throw fault(400, 'Unsupported resource');
    const result = await query(resourceQueries[resource], [id]);
    if (!result.rows.length) throw fault(404, 'Resource not found');
    return result.rows[0];
};
const validateLinks = async (req, context) => {
    const body = req.body || {};
    const patientId = body.patientId || body.patient_id;
    if (patientId && patientId !== context.patient_id) throw fault(400, 'Patient does not match the requested resource');
    if (req.params?.patientId && req.params.patientId !== context.patient_id) throw fault(400, 'Patient does not match the requested resource');
    const visitId = body.visitId || body.visit_id;
    if (visitId) {
        if (context.visit_id && visitId !== context.visit_id) throw fault(400, 'Visit does not match the requested resource');
        const visit = await resolveResource('visit', visitId);
        if (visit.patient_id !== context.patient_id) throw fault(400, 'Patient does not match the visit');
    }
    const recordId = body.recordId || body.record_id;
    if (recordId && context.record_id !== recordId) {
        const record = await resolveResource('record', recordId);
        if (record.patient_id !== context.patient_id || (context.visit_id && record.visit_id !== context.visit_id)) throw fault(400, 'Medical record does not match the resource');
    }
    if (body.orderId) {
        const order = await resolveResource('imagingOrder', body.orderId);
        if (order.patient_id !== context.patient_id || (context.visit_id && order.visit_id !== context.visit_id)) throw fault(400, 'Imaging order does not match the resource');
    }
    for (const [field, resource] of [['prescriptionId', 'prescription'], ['labResultId', 'labResult'], ['imagingReportId', 'imagingReport']]) {
        if (!body[field]) continue;
        const linked = await resolveResource(resource, body[field]);
        if (linked.patient_id !== context.patient_id || (context.visit_id && linked.visit_id !== context.visit_id)) throw fault(400, 'Linked clinical resource does not match the visit');
    }
};
const clinicalAccess = ({ resource = 'patient', id = req => req.params.patientId || req.body.patientId, access = 'read', category = 'all', roles } = {}) => async (req, res, next) => {
    try {
        if (!req.user) return fail(req, res, 401, 'Authentication required');
        const role = roleOf(req);
        if ((roles && !roles.includes(role)) || (!PROVIDERS.includes(role) && !(role === 'patient' && access === 'read'))) return fail(req, res, 403, 'Clinical access denied');
        const context = await resolveResource(typeof resource === 'function' ? resource(req) : resource, id(req));
        await validateLinks(req, context);
        const requestedCategory = typeof category === 'function' ? category(req, context) : category;
        const dataCategory = requestedCategory === 'vital_signs' ? 'vitals' : requestedCategory;
        req.clinicalCategory = dataCategory;
        if (!['all', 'all_medical_data', 'diagnoses', 'prescriptions', 'lab_results', 'imaging', 'clinical_notes', 'vitals', 'billing', 'insurance_claim', 'demographics'].includes(dataCategory)) return fail(req, res, 400, 'Invalid data category');
        if (role === 'patient') {
            if (context.patient_id !== req.user.id) return fail(req, res, 403, 'You can only access your own records');
        } else {
            const consent = await findMatchingConsent(context.patient_id, req.user.id, dataCategory, access);
            if (consent) req.consentContext = { id: consent.id, purpose: consent.purpose, dataCategory: consent.data_category, source: consent.source, workflow: 'clinical' };
            let emergency;
            if (role === 'doctor' && access === 'read') {
                emergency = (await query(`SELECT g.id FROM emergency_access_grants g JOIN visits v ON v.id=g.visit_id
                    JOIN staff_org_mapping som ON som.organization_id=g.organization_id AND som.user_id=g.user_id AND som.status='active'
                    WHERE g.patient_id=$1 AND g.user_id=$2 AND g.status='active' AND g.expires_at>NOW()
                    AND v.patient_id=g.patient_id AND v.organization_id=g.organization_id AND v.status IN ('checked_in','in_progress')
                    ORDER BY g.expires_at DESC LIMIT 1`, [context.patient_id, req.user.id])).rows[0];
            }
            if (!consent && !emergency) return fail(req, res, 403, 'Active patient consent is required');
            if (emergency) req.emergencyGrantId = emergency.id;
            const care = emergency ? { rows: [emergency] } : await query(`SELECT access_visit.id FROM visits access_visit WHERE access_visit.patient_id = $1
                ${access === 'write' && context.visit_id ? 'AND access_visit.id = $3' : ''}
                AND access_visit.status IN ${activeStates} AND ${organizationSql('access_visit.organization_id', '$2')}
                ${['doctor', 'nurse'].includes(role) ? `AND ${assignmentSql('access_visit', '$2')}` : ''} LIMIT 1`,
            access === 'write' && context.visit_id ? [context.patient_id, req.user.id, context.visit_id] : [context.patient_id, req.user.id]);
            if (!care.rows.length) return fail(req, res, 403, 'An active authorized care context is required');
        }
        req.clinicalContext = context;
        return next();
    } catch (error) { return fail(req, res, error.status || 500, error.status ? error.message : 'Unable to authorize clinical access'); }
};

const canManageOrganization = async (user, organizationId) => {
    if (user.roleName === 'system_admin') return true;
    if (user.roleName !== 'hospital_admin') return false;
    const result = await query(`SELECT id FROM organizations WHERE id = $1 AND admin_user_id = $2`, [organizationId, user.id]);
    return result.rows.length > 0;
};
const visitAccess = ({ id = req => req.params.id, resource = 'visit', administrative = false, roles } = {}) => async (req, res, next) => {
    try {
        if (!req.user) return fail(req, res, 401, 'Authentication required');
        const role = roleOf(req);
        if (roles && !roles.includes(role)) return fail(req, res, 403, 'Visit access denied');
        const visit = await resolveResource(resource, id(req));
        await validateLinks(req, visit);
        let allowed = false;
        if (role === 'patient') allowed = !administrative && visit.patient_id === req.user.id;
        else if (administrative && ['hospital_admin', 'system_admin'].includes(role)) allowed = await canManageOrganization(req.user, visit.organization_id);
        else if (role === 'receptionist' && administrative) {
            const membership = await query(`SELECT 1 FROM staff_org_mapping WHERE user_id = $1 AND organization_id = $2 AND status = 'active'`, [req.user.id, visit.organization_id]);
            allowed = membership.rows.length > 0;
        } else if (['doctor', 'nurse'].includes(role)) {
            const assignment = await query(`SELECT access_visit.id FROM visits access_visit WHERE access_visit.id = $1 AND ${organizationSql('access_visit.organization_id', '$2')} AND ${assignmentSql('access_visit', '$2')}`, [visit.visit_id || visit.id, req.user.id]);
            allowed = assignment.rows.length > 0;
        }
        if (!allowed) return fail(req, res, 403, 'Visit access denied');
        req.visitContext = visit;
        return next();
    } catch (error) { return fail(req, res, error.status || 500, error.status ? error.message : 'Unable to authorize visit access'); }
};

const orgContext = async (req, res, next) => {
    try {
        const result = await query(`SELECT id FROM organizations WHERE admin_user_id = $1
            UNION SELECT organization_id AS id FROM staff_org_mapping WHERE user_id = $1 AND status = 'active' ORDER BY id LIMIT 1`, [req.user.id]);
        if (!result.rows.length) return fail(req, res, 403, 'An active organization membership is required');
        req.organizationId = result.rows[0].id;
        return next();
    } catch (_) { return fail(req, res, 500, 'Unable to resolve organization'); }
};
const staffRoleAllowed = (actorRole, targetRole) => actorRole === 'system_admin'
    ? [...STAFF_ROLES, 'hospital_admin', 'compliance_officer', 'insurance_provider', 'researcher'].includes(targetRole)
    : actorRole === 'hospital_admin' && STAFF_ROLES.includes(targetRole);

const adminContext = async (req, res, next) => {
    if (req.user?.roleName === 'system_admin') return next();
    if (req.user?.roleName !== 'hospital_admin') return fail(req, res, 403, 'Administrator access required');
    try {
        const result = await query('SELECT id FROM organizations WHERE admin_user_id = $1 ORDER BY id LIMIT 1', [req.user.id]);
        if (!result.rows.length) return fail(req, res, 403, 'No managed organization');
        req.organizationId = result.rows[0].id;
        return next();
    } catch (_) { return fail(req, res, 500, 'Unable to resolve administrative scope'); }
};
const managedMapping = async (req, res, next) => {
    try {
        const result = await query('SELECT user_id, organization_id FROM staff_org_mapping WHERE id = $1', [validId(req.body.mappingId)]);
        const mapping = result.rows[0];
        if (!mapping) return fail(req, res, 404, 'Staff mapping not found');
        if (!await canManageOrganization(req.user, mapping.organization_id)) return fail(req, res, 403, 'Mapping is outside your administrative scope');
        return next();
    } catch (error) { return fail(req, res, error.status || 500, error.status ? error.message : 'Unable to authorize mapping'); }
};

const managedUser = (id = req => req.params.userId || req.body.userId) => async (req, res, next) => {
    try {
        if (req.user.roleName === 'system_admin') return next();
        const userId = validId(id(req));
        const result = await query(`SELECT target.id FROM users target JOIN roles r ON r.id = target.role_id
            JOIN staff_org_mapping som ON som.user_id = target.id JOIN organizations o ON o.id = som.organization_id
            WHERE target.id = $1 AND o.admin_user_id = $2 AND r.name = ANY($3::text[])`, [userId, req.user.id, STAFF_ROLES]);
        if (!result.rows.length) return fail(req, res, 403, 'Account is outside your administrative scope');
        return next();
    } catch (error) { return fail(req, res, error.status || 500, error.status ? error.message : 'Unable to authorize account access'); }
};
const managedInvitation = async (req, res, next) => {
    try {
        const result = await query('SELECT organization_id, role FROM staff_invitations WHERE id = $1', [validId(req.params.id)]);
        const invitation = result.rows[0];
        if (!invitation) return fail(req, res, 404, 'Invitation not found');
        if (!staffRoleAllowed(req.user.roleName, invitation.role) || !await canManageOrganization(req.user, invitation.organization_id)) return fail(req, res, 403, 'Invitation is outside your administrative scope');
        return next();
    } catch (error) { return fail(req, res, error.status || 500, error.status ? error.message : 'Unable to authorize invitation'); }
};
const assignedStaff = async (req, res, next) => {
    try {
        const visit = req.visitContext || req.clinicalContext;
        if (!visit) return fail(req, res, 400, 'Visit context is required');
        const body = req.body || {};
        const targets = [[body.doctorId || body.assignedDoctorId, 'doctor'], [body.nurseId || body.assignedNurseId, 'nurse'], [body.staffUserId, body.role]];
        for (const [id, suppliedRole] of targets) {
            if (!id) continue;
            const role = ['primary', 'primary_doctor', 'consulting_doctor', 'consultant'].includes(suppliedRole) ? 'doctor' : suppliedRole;
            if (!STAFF_ROLES.includes(role)) return fail(req, res, 400, 'Invalid clinical staff role');
            const result = await query(`SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
                JOIN staff_org_mapping som ON som.user_id = u.id
                WHERE u.id = $1 AND som.organization_id = $2 AND som.status = 'active' AND u.status = 'active' AND r.name = $3`, [validId(id), visit.organization_id, role]);
            if (!result.rows.length) return fail(req, res, 403, 'Assigned staff must hold the requested role in this organization');
        }
        return next();
    } catch (error) { return fail(req, res, error.status || 500, error.status ? error.message : 'Unable to validate staff assignment'); }
};
const notificationTarget = async (req, res, next) => {
    try {
        const body = req.body || {};
        const target = validId(body.userId);
        if (typeof body.title !== 'string' || body.title.length < 1 || body.title.length > 200 || typeof body.message !== 'string' || body.message.length < 1 || body.message.length > 2000) return fail(req, res, 400, 'A title and message within the allowed lengths are required');
        if (body.relatedEntityId) {
            if (body.relatedEntityType !== 'visit') return fail(req, res, 400, 'Only visit notifications may link a clinical resource');
            const visit = await resolveResource('visit', body.relatedEntityId);
            if (visit.patient_id !== target) return fail(req, res, 400, 'Notification recipient does not match the visit');
        }
        if (target !== req.user.id) {
            let allowed;
            if (req.user.roleName === 'hospital_admin') {
                const result = await query(`SELECT 1 FROM organizations o WHERE o.admin_user_id=$1 AND (
                    EXISTS (SELECT 1 FROM staff_org_mapping som WHERE som.organization_id=o.id AND som.user_id=$2 AND som.status='active')
                    OR EXISTS (SELECT 1 FROM visits v WHERE v.organization_id=o.id AND v.patient_id=$2 AND v.status IN ('pending','approved','scheduled','checked_in','in_progress'))) LIMIT 1`, [req.user.id, target]);
                allowed = result.rows.length > 0;
            } else {
                const result = await query(`SELECT access_visit.id FROM visits access_visit WHERE access_visit.patient_id=$1
                    AND access_visit.status IN ${activeStates} AND ${organizationSql('access_visit.organization_id', '$2')}
                    AND ${assignmentSql('access_visit', '$2')} AND ${consentSql('access_visit.patient_id', '$2')} LIMIT 1`, [target, req.user.id]);
                allowed = result.rows.length > 0;
            }
            if (!allowed) return fail(req, res, 403, 'Notification recipient is outside your care scope');
        }
        // External delivery is an internal service responsibility, never a caller-supplied channel.
        req.body.channels = ['in_app'];
        return next();
    } catch (error) { return fail(req, res, error.status || 500, error.status ? error.message : 'Unable to authorize notification'); }
};
module.exports = { clinicalAccess, visitAccess, orgContext, adminContext, managedMapping, managedUser, managedInvitation, assignedStaff, notificationTarget, staffRoleAllowed, canManageOrganization, consentSql, organizationSql, assignmentSql, clinicalScopeSql, resolveResource, STAFF_ROLES, RECORD_CATEGORIES };
