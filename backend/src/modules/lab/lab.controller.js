const db = require('../../config/db');
const FileUploadService = require('../../services/file.upload.service');
const { logAuditEvent } = require('../../services/audit.service');
const { clinicalScopeSql } = require('../../middleware/clinical-access.middleware');
const scope = (req, parameter = '$1', patient = 'v.patient_id', visit = 'v.id') => clinicalScopeSql(patient, visit, parameter, req.user.roleName, 'lab_results');
const orderSelect = `SELECT lo.*, lo.created_at AS requested_time, lo.notes,
    v.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
    d.first_name || ' ' || d.last_name AS doctor
    FROM lab_orders lo JOIN visits v ON v.id = lo.visit_id JOIN users p ON p.id = v.patient_id
    JOIN users d ON d.id = lo.ordered_by`;
const getStats = async (req, res, next) => {
    try {
        const result = await db.query(`SELECT COUNT(*) FILTER (WHERE lo.status NOT IN ('completed','cancelled')) AS pending,
            COUNT(*) FILTER (WHERE lo.status = 'completed' AND lo.result_available_at >= CURRENT_DATE) AS completed_today,
            COUNT(*) FILTER (WHERE lo.status = 'completed') AS uploaded
            FROM lab_orders lo JOIN visits v ON v.id = lo.visit_id WHERE ${scope(req)}`, [req.user.id]);
        const row = result.rows[0];
        res.json({ success: true, data: { pending: Number(row.pending), completedToday: Number(row.completed_today), totalUploaded: Number(row.uploaded) } });
    } catch (error) { next(error); }
};
const getAssignedOrders = async (req, res, next) => {
    try {
        const result = await db.query(`${orderSelect} WHERE lo.status NOT IN ('completed','cancelled') AND ${scope(req)} ORDER BY lo.created_at LIMIT 100`, [req.user.id]);
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
};
const getOrderById = async (req, res, next) => {
    try {
        const result = await db.query(`${orderSelect} WHERE lo.id = $1 AND ${scope(req, '$2')}`, [req.params.id, req.user.id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Lab order not found' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) { next(error); }
};
const uploadResult = async (req, res, next) => {
    let fileInfo;
    let committed = false;
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'A result file is required' });
        const context = req.clinicalContext;
        fileInfo = await FileUploadService.processUpload(req.file, { patientId: context.patient_id, fileType: 'lab_results' });
        const result = await db.transaction(async client => {
            let recordId = req.body.record_id;
            let orderedBy = req.user.id;
            let order;
            if (req.body.order_id) {
                const locked = await client.query('SELECT * FROM lab_orders WHERE id = $1 FOR UPDATE', [req.body.order_id]);
                order = locked.rows[0];
                if (!order || ['completed', 'cancelled'].includes(order.status)) throw Object.assign(new Error('Lab order is not open'), { statusCode: 409 });
                orderedBy = order.ordered_by;
            }
            if (!recordId) {
                const record = await client.query(`INSERT INTO medical_records (patient_id, visit_id, type, title, description, created_by, immutable_flag)
                    VALUES ($1,$2,'lab_result',$3,$4,$5,true) RETURNING id`, [context.patient_id, context.visit_id, order?.test_name || 'Lab result', req.body.notes || null, req.user.id]);
                recordId = record.rows[0].id;
            }
            const created = await client.query(`INSERT INTO lab_results (record_id,test_name,test_code,test_category,file_url,file_name,file_type,file_size,results_data,ordered_by,performed_by,result_date)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
                [recordId, order?.test_name || req.body.test_name || 'Lab Test', order?.test_code || req.body.test_code || null,
                    order?.test_category || req.body.test_category || null, fileInfo.fileUrl, fileInfo.fileName, fileInfo.fileType, fileInfo.fileSize,
                    JSON.stringify({ notes: req.body.notes || '' }), orderedBy, req.user.id]);
            if (order) await client.query("UPDATE lab_orders SET status='completed', lab_result_id=$1, result_available_at=NOW(), updated_at=NOW() WHERE id=$2", [created.rows[0].id, order.id]);
            await logAuditEvent({ userId: req.user.id, action: 'upload_lab_result', entityType: 'lab_result',
                entityId: created.rows[0].id, statusCode: 201, ipAddress: req.ip,
                metadata: { patientId: context.patient_id, organizationId: context.organization_id, visitId: context.visit_id } }, client);
            return created.rows[0];
        });
        committed = true;
        req.auditEventRecorded = true;
        res.status(201).json({ success: true, data: result, message: 'Lab result uploaded successfully' });
    } catch (error) {
        if (!committed && fileInfo?.filePath) await FileUploadService.deleteFile(fileInfo.filePath).catch(() => {});
        next(error);
    }
};
const getUploadedResults = async (req, res, next) => {
    try {
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const offset = Math.max(0, Number(req.query.offset) || 0);
        const result = await db.query(`SELECT lr.*, mr.patient_id, p.first_name || ' ' || p.last_name AS patient_name,
            t.first_name || ' ' || t.last_name AS performed_by_name FROM lab_results lr
            JOIN medical_records mr ON mr.id=lr.record_id JOIN users p ON p.id=mr.patient_id
            LEFT JOIN users t ON t.id=lr.performed_by
            WHERE ${clinicalScopeSql('mr.patient_id', 'mr.visit_id', '$1', req.user.roleName, 'lab_results')}
            ORDER BY lr.uploaded_at DESC LIMIT $2 OFFSET $3`, [req.user.id, limit, offset]);
        res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
};
module.exports = { getStats, getAssignedOrders, getOrderById, uploadResult, getUploadedResults };
