import apiClient, { API_BASE_URL } from '../api/client';

export function getDownloadPath(value) {
    const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
    const url = new URL(value, apiOrigin);
    if (url.origin !== apiOrigin || url.username || url.password || url.search || url.hash) {
        throw new Error('Unsupported download URL');
    }
    const path = url.pathname.replace(/^\/uploads\/medical_files\//, '/api/files/');
    if (/^\/api(?:\/v\d+)?\/files\/[^/]+\/(?:lab_results|imaging|imaging_reports|radiology)\/[^/]+$/.test(path)) {
        return path.replace(/^\/api(?:\/v\d+)?/, '');
    }
    if (/^\/api(?:\/v\d+)?\/doctors\/verification\/documents\/[^/]+\/download$/.test(path)) {
        return path.replace(/^\/api(?:\/v\d+)?/, '');
    }
    throw new Error('Unsupported download URL');
}

export async function downloadFile(url, name) {
    const path = getDownloadPath(url);
    const response = await apiClient.get(path, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = objectUrl;
    const filename = name || path.split('/').at(-1) || 'report';
    link.download = Array.from(filename, character => character.charCodeAt(0) < 32 || '/\\'.includes(character) ? '_' : character).join('');
    document.body.appendChild(link);
    try { link.click(); } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
}
