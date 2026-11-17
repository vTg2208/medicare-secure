import { useCallback, useEffect, useState } from 'react';
import { complianceApi } from '../../api/complianceApi';

export function useSecurityDashboard() {
    const [snapshot, setSnapshot] = useState(null);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(true);
    const [revision, setRevision] = useState(0);
    const refresh = useCallback(() => setRevision(value => value + 1), []);
    useEffect(() => {
        const controller = new AbortController();
        let timer;
        const load = async () => {
            setRefreshing(true);
            try {
                const result = await complianceApi.getDashboardStats({ signal: controller.signal });
                if (controller.signal.aborted) return;
                if (!result.success || !result.data || !['critical','attention','clear'].includes(result.data.securityStatus) ||
                    !Array.isArray(result.data.recentIncidents) || !Number.isFinite(Date.parse(result.data.generatedAt))) {
                    throw new Error('Incomplete dashboard snapshot');
                }
                setSnapshot(result.data);
                setError('');
            } catch {
                if (!controller.signal.aborted) setError('Unable to refresh security data. Displayed values may be stale. Retry to get the current status.');
            } finally {
                if (!controller.signal.aborted) {
                    setRefreshing(false);
                    // Schedule after completion so a slow request never overlaps.
                    timer = setTimeout(load, 30000);
                }
            }
        };
        load();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [revision]);
    return { snapshot, error, refreshing, refresh };
}
