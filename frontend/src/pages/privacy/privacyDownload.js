export function savePrivacyExport(data) {
    // This exact UTF-8 JSON serialization is the server receipt's digest contract.
    const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = href; anchor.download = `medicare-information-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(href), 1000); }
}
