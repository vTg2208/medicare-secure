import apiClient from '../api/client';
import { downloadFile, getDownloadPath } from './downloadFile';

test.each([
    ['/api/files/p1/lab_results/result.pdf', '/files/p1/lab_results/result.pdf'],
    ['/uploads/medical_files/p1/imaging/scan.png', '/files/p1/imaging/scan.png'],
    ['/api/doctors/verification/documents/d1/download', '/doctors/verification/documents/d1/download'],
])('routes supported file %s through authenticated API', (url, path) => expect(getDownloadPath(url)).toBe(path));

test.each(['https://evil.test/api/files/p1/lab_results/a.pdf', '//evil.test/a', 'javascript:alert(1)', '/api/auth/logout', '/uploads/medical_files/../a', '/api/files/p1/lab_results/a.pdf?token=x'])('rejects untrusted download %s before sending credentials', async (url) => {
    const request = vi.spyOn(apiClient, 'get');
    await expect(downloadFile(url)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
});

test('downloads using a credentialed blob request and releases the object URL', async () => {
    vi.useFakeTimers();
    const blob = new Blob(['report']);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: blob });
    const create = vi.fn(() => 'blob:report');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
        await downloadFile('/api/files/p1/lab_results/report.pdf', 'report.pdf');
        expect(apiClient.get).toHaveBeenCalledWith('/files/p1/lab_results/report.pdf', { responseType: 'blob' });
        expect(click).toHaveBeenCalledOnce();
        expect(create).toHaveBeenCalledWith(blob);
        vi.runAllTimers();
        expect(revoke).toHaveBeenCalledWith('blob:report');
    } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
});
