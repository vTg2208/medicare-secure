import { reportWebVital, startPerformanceMonitoring } from './performanceMonitoring';
import { onCLS, onINP, onLCP } from 'web-vitals';
vi.mock('web-vitals', () => ({ onCLS: vi.fn(), onINP: vi.fn(), onLCP: vi.fn() }));
vi.mock('../api/client', () => ({ API_BASE_URL: '/api' }));
test('reports only aggregate metric names and values, omitting patient attribution and credentials', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', send);
    try {
        await reportWebVital({ name: 'LCP', value: 1234.5678, id: 'patient-id', entries: [{ url: '/patient/private-record' }], attribution: { target: 'private' } });
        expect(send).toHaveBeenCalledWith('/api/performance', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }));
        expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({ name: 'LCP', value: 1234.568 });
        send.mockClear();
        await reportWebVital({ name: 'private', value: 10 });
        await reportWebVital({ name: 'CLS', value: NaN });
        expect(send).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
});
test('registers metric observers once and tolerates an offline collector', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')));
    try {
        await startPerformanceMonitoring();
        await startPerformanceMonitoring();
        expect(onLCP).toHaveBeenCalledTimes(1);
        expect(onINP).toHaveBeenCalledTimes(1);
        expect(onCLS).toHaveBeenCalledTimes(1);
        await expect(reportWebVital({ name: 'INP', value: 100 })).resolves.toBeUndefined();
    } finally { vi.unstubAllGlobals(); }
});
