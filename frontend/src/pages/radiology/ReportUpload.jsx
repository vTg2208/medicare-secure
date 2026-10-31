import Brand from '../../components/common/Brand';
import React, { useState, useRef, useContext, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import radiologyApi from '../../api/radiologyApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import './RadiologyDashboard.css';

const IMAGING_TYPES = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'PET Scan', 'Mammogram', 'DICOM', 'Other'];

function ReportUpload() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, logout } = useContext(AuthContext);
    const fileInputRef = useRef(null);

    // Pre-fill from URL params (when coming from ImagingQueue)
    const prefillOrderId = searchParams.get('orderId') || '';
    const prefillVisitId = searchParams.get('visitId') || '';
    const prefillPatient = searchParams.get('patient') || '';
    const prefillType = searchParams.get('type') || '';

    const [form, setForm] = useState({
        orderId: prefillOrderId,
        visitId: prefillVisitId,
        patientName: prefillPatient,
        imagingType: prefillType || '',
        bodyPart: '',
        findings: '',
        impression: '',
        radiologistNotes: '',
        studyDate: new Date().toISOString().slice(0, 10),
    });

    const [file, setFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const handleFile = (f) => {
        if (!f) return;
        const maxSize = 20 * 1024 * 1024; // 20 MB
        if (f.size > maxSize) {
            setErrors(prev => ({ ...prev, file: 'File size must be under 20 MB.' }));
            return;
        }
        setFile(f);
        setErrors(prev => ({ ...prev, file: undefined }));
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFile(dropped);
    }, []);

    const validate = () => {
        const errs = {};
        if (!form.visitId.trim()) errs.visitId = 'Visit ID is required.';
        if (!form.imagingType) errs.imagingType = 'Imaging type is required.';
        if (!form.findings.trim()) errs.findings = 'Findings are required.';
        if (!form.impression.trim()) errs.impression = 'Impression is required.';
        if (!file) errs.file = 'Please attach the imaging report file.';
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        setSubmitting(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('visitId', form.visitId);
            formData.append('orderId', form.orderId);
            formData.append('imagingType', form.imagingType.toLowerCase().replace(' ', '_'));
            formData.append('bodyPart', form.bodyPart);
            formData.append('findings', form.findings);
            formData.append('impression', form.impression);
            formData.append('radiologistNotes', form.radiologistNotes);
            formData.append('studyDate', form.studyDate);
            formData.append('performedBy', user?.id || '');
            formData.append('file', file);

            const res = await radiologyApi.uploadReport(formData);

            if (res.success) {
                setResult({ success: true, message: res.message || 'Imaging report uploaded successfully.' });
                setForm(prev => ({ ...prev, findings: '', impression: '', radiologistNotes: '', bodyPart: '' }));
                setFile(null);
            } else {
                setResult({ success: false, message: 'Upload failed: Server returned an error.' });
            }
        } catch (err) {
            const msg = err?.response?.data?.message || 'Upload failed. Please check your connection and try again.';
            setResult({ success: false, message: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="radiology-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative mc-sidebar">
                <Brand to={'/radiology/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <Link to="/radiology/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/radiology/queue" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">view_list</span>
                        Imaging Queue
                    </Link>
                    <Link to="/radiology/audit-logs" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history_edu</span>
                        Audit Logs
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/radiology/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}


                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 border-b border-transparent transition-all pr-[80px]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/radiology/queue')}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg p-2 transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-accent">
                                Upload Imaging Report
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Reports are securely stored and linked to the patient visit</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide">

                    <div className="max-w-4xl">
                        {/* Audit Log / Crypto Notice */}
                        <div className="flex items-center gap-3 p-4 bg-primary-50/50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20 rounded-2xl mb-6">
                            <span className="material-symbols-outlined text-primary-500 text-[24px]">verified_user</span>
                            <p className="text-sm text-primary-900 dark:text-primary-200 leading-relaxed">
                                <strong>Secure Upload:</strong> This report will be cryptographically linked to the patient visit
                                and your radiologist ID. Uploads are immutable and fully audited.
                            </p>
                        </div>

                        {/* Result Banner */}
                        {result && (
                            <div className={`p-4 rounded-2xl flex items-center justify-between gap-4 border shadow-sm mb-6 ${result.success
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300'
                                : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined">
                                        {result.success ? 'check_circle' : 'error'}
                                    </span>
                                    <span>{result.message}</span>
                                </div>
                                {result.success && (
                                    <button
                                        onClick={() => navigate('/radiology/queue')}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                                    >
                                        Back to Queue
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Form Body */}
                        <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 pb-10 shadow-sm transition-all">

                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">Patient & Order Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Visit ID <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        name="visitId"
                                        value={form.visitId}
                                        onChange={handleChange}
                                        placeholder="e.g. VST-001"
                                        className={`w-full px-4 py-3 rounded-xl bg-surface dark:bg-slate-900/50 border ${errors.visitId ? 'border-rose-500 shadow-sm shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'} text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50`}
                                    />
                                    {errors.visitId && <p className="text-rose-500 text-xs mt-1.5 ml-1">{errors.visitId}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Imaging Order ID</label>
                                    <input
                                        type="text"
                                        name="orderId"
                                        value={form.orderId}
                                        onChange={handleChange}
                                        placeholder="Auto-filled from queue"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Patient Name</label>
                                    <input
                                        type="text"
                                        name="patientName"
                                        value={form.patientName}
                                        onChange={handleChange}
                                        placeholder="Auto-filled from queue"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Study Date</label>
                                    <input
                                        type="date"
                                        name="studyDate"
                                        value={form.studyDate}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl bg-surface dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    />
                                </div>
                            </div>

                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">Clinical Report</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Imaging Type <span className="text-rose-500">*</span></label>
                                    <select
                                        name="imagingType"
                                        value={form.imagingType}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 rounded-xl bg-surface dark:bg-slate-900/50 border ${errors.imagingType ? 'border-rose-500 shadow-sm shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'} text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 appearance-none`}
                                    >
                                        <option value="">— Select type —</option>
                                        {IMAGING_TYPES.map(t => (<option key={t} value={t}>{t}</option>))}
                                    </select>
                                    {errors.imagingType && <p className="text-rose-500 text-xs mt-1.5 ml-1">{errors.imagingType}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Body Part / Region</label>
                                    <input
                                        type="text"
                                        name="bodyPart"
                                        value={form.bodyPart}
                                        onChange={handleChange}
                                        placeholder="e.g. Chest, Brain, Abdomen"
                                        className="w-full px-4 py-3 rounded-xl bg-surface dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Findings <span className="text-rose-500">*</span></label>
                                    <textarea
                                        name="findings"
                                        value={form.findings}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder="Describe the radiological findings in detail…"
                                        className={`w-full px-4 py-3 rounded-xl bg-surface dark:bg-slate-900/50 border ${errors.findings ? 'border-rose-500 shadow-sm shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'} text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-y`}
                                    />
                                    {errors.findings && <p className="text-rose-500 text-xs mt-1.5 ml-1">{errors.findings}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Impression <span className="text-rose-500">*</span></label>
                                    <textarea
                                        name="impression"
                                        value={form.impression}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="Clinical impression / diagnosis summary…"
                                        className={`w-full px-4 py-3 rounded-xl bg-surface dark:bg-slate-900/50 border ${errors.impression ? 'border-rose-500 shadow-sm shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'} text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-y`}
                                    />
                                    {errors.impression && <p className="text-rose-500 text-xs mt-1.5 ml-1">{errors.impression}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Additional Notes</label>
                                    <textarea
                                        name="radiologistNotes"
                                        value={form.radiologistNotes}
                                        onChange={handleChange}
                                        rows={2}
                                        placeholder="Optional: follow-up recommendations, technical notes…"
                                        className="w-full px-4 py-3 rounded-xl bg-surface dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-y"
                                    />
                                </div>
                            </div>

                            <div className="mt-8">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Attachment <span className="text-rose-500">*</span></label>
                                <div
                                    className={`w-full p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors cursor-pointer ${dragOver ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10" :
                                        errors.file ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' :
                                            file ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' :
                                                'border-slate-300 dark:border-slate-700 bg-surface hover:bg-surface dark:bg-slate-900/30 dark:hover:bg-slate-800/80'
                                        }`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.dcm"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handleFile(e.target.files[0])}
                                    />

                                    {file ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                                                <span className="material-symbols-outlined text-[32px]">task</span>
                                            </div>
                                            <p className="font-bold text-slate-800 dark:text-white mb-1">{file.name}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                                className="px-4 py-2 bg-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:text-rose-500 hover:border-rose-200"
                                            >
                                                Remove File
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-center">
                                            <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-500/10 text-primary-500 dark:text-primary-400 flex items-center justify-center mb-3">
                                                <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                                            </div>
                                            <p className="font-bold text-slate-800 dark:text-white text-lg">Click to upload or drag & drop</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Supports PDF, JPEG, PNG, DICOM (.dcm) — max 20 MB</p>
                                        </div>
                                    )}
                                </div>
                                {errors.file && <p className="text-rose-500 text-xs mt-1.5 ml-1">{errors.file}</p>}
                            </div>

                            <div className="flex items-center justify-end gap-4 mt-10 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => navigate('/radiology/queue')}
                                    className="px-6 py-3 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="min-w-[160px] px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-70 disabled:hover:bg-primary-600 text-white rounded-lg font-medium shadow-sm shadow-primary-600/20 transition-colors flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            Submit Report
                                            <span className="material-symbols-outlined text-[20px]">send</span>
                                        </>
                                    )}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ReportUpload;
