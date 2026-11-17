const { query } = require('../../config/db');

async function getSecuritySnapshot() {
    // One SQL statement gives counts and the incident preview the same snapshot.
    // Open = not yet reviewed; Investigating is separate from that work queue.
    const { rows: [row] } = await query(`WITH unresolved AS MATERIALIZED (
        SELECT id,event_type,severity,description,COALESCE(status,'Open') AS status,
            created_at AT TIME ZONE current_setting('TimeZone') AS created_at
        FROM security_events WHERE status IS DISTINCT FROM 'Resolved'
    ) SELECT statement_timestamp() AS generated_at,
        (SELECT COUNT(*)::int FROM audit_logs WHERE timestamp>NOW()-INTERVAL '24 hours'
            AND (LOWER(action) IN ('user_login_failed','failed_login','access_denied') OR status_code IN (401,403))) AS auth_anomalies,
        (SELECT COUNT(*)::int FROM emergency_access_grants WHERE status='active' AND expires_at>NOW()) AS active_overrides,
        COUNT(*)::int AS open_incidents,
        COUNT(*) FILTER (WHERE status='Open')::int AS pending_reviews,
        COUNT(*) FILTER (WHERE status='Investigating')::int AS investigating_incidents,
        COUNT(*) FILTER (WHERE severity='critical')::int AS critical_incidents,
        COUNT(*) FILTER (WHERE severity='high')::int AS high_incidents,
        COALESCE((SELECT jsonb_agg(recent ORDER BY recent.created_at DESC,recent.id DESC)
            FROM (SELECT * FROM unresolved ORDER BY created_at DESC,id DESC LIMIT 3) recent),'[]'::jsonb) AS recent_incidents
        FROM unresolved`);
    const securityStatus = row.critical_incidents > 0 ? 'critical' :
        row.open_incidents > 0 || row.active_overrides > 0 || row.auth_anomalies > 0 ? 'attention' : 'clear';
    return { authAnomalies: row.auth_anomalies, openIncidents: row.open_incidents,
        pendingReviews: row.pending_reviews, investigatingIncidents: row.investigating_incidents,
        criticalIncidents: row.critical_incidents, highIncidents: row.high_incidents,
        activeOverrides: row.active_overrides, generatedAt: row.generated_at, securityStatus, complianceScore: null,
        recentIncidents: row.recent_incidents.map(event => ({ id: event.id,
            type: event.event_type.split('_').map(word => word.charAt(0).toUpperCase()+word.slice(1)).join(' '),
            severity: event.severity, status: event.status, reporter: 'System', date: event.created_at, description: event.description })) };
}

module.exports = { getSecuritySnapshot };
