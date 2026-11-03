import './Pagination.css';

export default function Pagination({ page, pageSize, total, busy, onPageChange }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    return <nav className="mc-pagination" aria-label="Results pages">
        <button type="button" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">Previous</button>
        <span role="status" aria-live="polite">Page {page} of {pages} · {total} results</span>
        <button type="button" disabled={busy || page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">Next</button>
    </nav>;
}
