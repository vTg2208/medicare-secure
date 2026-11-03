import { useEffect, useState } from 'react';

const PAGE_SIZE = 20;
const EMPTY_ROWS = [];

export default function usePagedResults(loadPage, refreshInterval = 0) {
    const [selection, setSelection] = useState(null);
    const page = selection?.loader === loadPage ? selection.page : 1;
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState(null);
    const current = result?.loader === loadPage && result.page === page && result.revision === revision ? result : null;

    useEffect(() => {
        let active = true;
        let timer;
        const fetchPage = async () => {
            try {
                const response = await loadPage(PAGE_SIZE, (page - 1) * PAGE_SIZE);
                if (!active) return;
                if (!response.success) throw new Error(response.message || 'Unable to load results');
                const rows = response.data || EMPTY_ROWS;
                const total = response.pagination?.total ?? rows.length;
                const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
                if (page > lastPage) {
                    setSelection({ loader: loadPage, page: lastPage });
                    return;
                }
                setResult({ loader: loadPage, page, revision, rows, total, error: '' });
            } catch (error) {
                if (!active) return;
                const message = error.response?.data?.message || error.message || 'Unable to load results';
                setResult({ loader: loadPage, page, revision, rows: EMPTY_ROWS, total: 0, error: message });
            }
            if (active && refreshInterval) timer = setTimeout(fetchPage, refreshInterval);
        };
        fetchPage();
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [loadPage, page, refreshInterval, revision]);

    return {
        rows: current?.rows ?? EMPTY_ROWS,
        error: current?.error ?? '',
        loading: current === null,
        refresh: () => setRevision(value => value + 1),
        pagination: {
            page, pageSize: PAGE_SIZE, total: result?.loader === loadPage ? result.total : 0,
            busy: current === null || Boolean(current.error),
            onPageChange: next => setSelection({ loader: loadPage, page: next })
        }
    };
}
