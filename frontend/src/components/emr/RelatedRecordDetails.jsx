import React, { useState } from 'react';
import { emrApi } from '../../api/emrApi';
import { downloadFile } from '../../utils/downloadFile';

export default function RelatedRecordDetails({ recordId }) {
    const [record, setRecord] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(null);

    const open = async () => {
        if (record) { setExpanded(value => !value); return; }
        setLoading(true);
        setError('');
        try {
            const response = await emrApi.getMedicalRecord(recordId, { includeRelated: true });
            setRecord(response.data);
            setExpanded(true);
        } catch (failure) {
            setError(failure.response?.data?.message || 'Unable to load clinical details. Please retry.');
        } finally { setLoading(false); }
    };
    const download = async (item, title) => {
        setDownloading(item.id);
        setError('');
        try { await downloadFile(item.file_url, item.file_name || `${title} report`); }
        catch { setError('Unable to download this report. Please retry.'); }
        finally { setDownloading(null); }
    };
    const reportButton = (item, title) => item.file_url && (
        <button type="button" className="mt-2 underline text-[var(--mc-accent)]" disabled={downloading === item.id}
            onClick={() => download(item, title)} aria-label={`Download ${title} report`}>
            {downloading === item.id ? 'Downloading…' : 'Download report'}
        </button>
    );
    const hasDetails = record && ['diagnoses', 'prescriptions', 'labResults', 'imagingReports'].some(key => record[key]?.length);

    return (
        <div className="mt-4 border-t border-[var(--mc-border)] pt-3 text-sm text-[var(--mc-text)]">
            <button type="button" onClick={open} disabled={loading} aria-expanded={expanded}
                className="font-semibold text-[var(--mc-accent)] underline">
                {loading ? 'Loading clinical details…' : expanded ? 'Hide clinical details' : 'View clinical details'}
            </button>
            {error && <p role="alert" className="mt-2 text-[var(--mc-danger)]">{error}</p>}
            {expanded && record && <div className="mt-3 space-y-4">
                {!hasDetails && <p>No linked clinical details.</p>}
                {!!record.diagnoses?.length && <section aria-label="Diagnoses"><h4 className="font-semibold">Diagnoses</h4>
                    {record.diagnoses.map(item => <div key={item.id} className="mt-2">
                        <p>{item.icd_code} — {item.description}</p>
                        <p className="text-[var(--mc-text-muted)]">{item.status}{item.is_primary ? ' · Primary' : ''}{item.version ? ` · Version ${item.version}` : ''}</p>
                        {item.notes && <p className="whitespace-pre-wrap">{item.notes}</p>}
                    </div>)}
                </section>}
                {!!record.prescriptions?.length && <section aria-label="Prescriptions"><h4 className="font-semibold">Prescriptions</h4>
                    {record.prescriptions.map(item => <div key={item.id} className="mt-2">
                        <p className="font-medium">{item.medication}</p>
                        <p>{[item.dosage, item.frequency, item.route, item.duration].filter(Boolean).join(' · ')}</p>
                        <p className="text-[var(--mc-text-muted)]">{item.status}</p>
                        {item.instructions && <p className="whitespace-pre-wrap">{item.instructions}</p>}
                    </div>)}
                </section>}
                {!!record.labResults?.length && <section aria-label="Laboratory results"><h4 className="font-semibold">Laboratory results</h4>
                    {record.labResults.map(item => <div key={item.id} className="mt-2">
                        <p className="font-medium">{item.test_name}</p>
                        {item.abnormal_flag && <p>Flagged abnormal</p>}
                        {item.interpretation && <p className="whitespace-pre-wrap">{item.interpretation}</p>}
                        {item.reference_range && <p>Reference range: {item.reference_range}</p>}
                        {item.results_data && <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(item.results_data, null, 2)}</pre>}
                        {reportButton(item, item.test_name || 'Laboratory')}
                    </div>)}
                </section>}
                {!!record.imagingReports?.length && <section aria-label="Imaging reports"><h4 className="font-semibold">Imaging reports</h4>
                    {record.imagingReports.map(item => <div key={item.id} className="mt-2">
                        <p className="font-medium">{[item.imaging_type, item.body_part].filter(Boolean).join(' · ')}</p>
                        {item.findings && <p className="whitespace-pre-wrap">{item.findings}</p>}
                        {item.impression && <p className="whitespace-pre-wrap">{item.impression}</p>}
                        {item.radiologist_notes && <p className="whitespace-pre-wrap">{item.radiologist_notes}</p>}
                        {reportButton(item, item.imaging_type || 'Imaging')}
                    </div>)}
                </section>}
            </div>}
        </div>
    );
}
