import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { emrApi } from '../../api/emrApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import Toast from '../../components/common/Toast';

import '../patient/Dashboard.css';
import './MedicalRecords.css';

function MedicalRecords() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [expandedRecords, setExpandedRecords] = useState(new Set());
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState(null);
    const printableRef = useRef(null);

    const fetchRecords = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await emrApi.getPatientMedicalRecords(user.id);
            const recordList = response.data?.records || response.data || [];
            const formattedRecords = recordList.map(record => ({
                id: record.id,
                type: record.type,
                date: record.created_at || record.visit_date,
                doctor: record.created_by_name || 'Unknown Provider',
                doctorRole: record.created_by_role || '',
                title: record.title,
                summary: record.description,
            }));
            setRecords(formattedRecords);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }, [user.id]);

    useEffect(() => {
        if (user && user.id) fetchRecords();

        // Check for search query in URL
        const params = new URLSearchParams(location.search);
        const searchQ = params.get('search');
        if (searchQ) {
            setSearchTerm(searchQ);
        }
    }, [user, fetchRecords, location.search]);

    const filterRecords = () => {
        let filtered = records;

        // Apply type filter
        if (filter !== 'all') {
            filtered = filtered.filter(r => r.type === filter);
        }

        // Apply search term filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                (r.title && r.title.toLowerCase().includes(term)) ||
                (r.summary && r.summary.toLowerCase().includes(term)) ||
                (r.doctor && r.doctor.toLowerCase().includes(term)) ||
                (r.type && r.type.toLowerCase().includes(term))
            );
        }

        return filtered;
    };
    const filteredRecords = filterRecords();

    const toggleExpand = (recordId) => {
        setExpandedRecords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) newSet.delete(recordId);
            else newSet.add(recordId);
            return newSet;
        });
    };

    const formatRecordType = (type) => {
        const types = {
            'consultation': 'Consultation', 'diagnosis': 'Diagnosis',
            'prescription': 'Prescription', 'lab_result': 'Lab Result',
            'imaging': 'Imaging', 'procedure': 'Procedure',
            'note': 'Clinical Note', 'other': 'Other'
        };
        return types[type] || type;
    };

    const getRecordStyle = (type) => {
        switch (type) {
            case 'lab_result': return { bg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', icon: 'biotech', tag: 'Laboratory' };
            case 'prescription': return { bg: 'bg-amber-100  dark:bg-amber-900/30  text-amber-600  dark:text-amber-400', icon: 'prescriptions', tag: 'Medication' };
            case 'consultation': return { bg: 'bg-blue-100   dark:bg-blue-900/30   text-blue-600   dark:text-blue-400', icon: 'stethoscope', tag: 'Appointment' };
            case 'note': return { bg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', icon: 'psychology', tag: 'Note' };
            default: return { bg: 'bg-blue-100   dark:bg-blue-900/30   text-blue-600   dark:text-blue-400', icon: 'medical_services', tag: 'Record' };
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportPDF = async () => {
        setToast({ message: 'Generating your official PDF record...', type: 'info' });

        try {
            const element = printableRef.current;
            if (!element) throw new Error('Printable element not found');

            const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);

            // Capture the element
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight,
                windowWidth: element.scrollWidth
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgProps = pdf.getImageProperties(imgData);
            const imgWidth = pdfWidth;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            let heightLeft = imgHeight;
            let position = 0;

            // Add the first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            // Add subsequent pages if content is longer than one page
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Medical_Record_${user?.firstName || 'Patient'}.pdf`);
            setToast({ message: 'Medical Record PDF downloaded successfully!', type: 'success' });
        } catch (error) {
            setToast({ message: 'Failed to generate PDF. Falling back to print dialog.', type: 'warning' });
            window.print();
        }
    };

    const handleShare = () => {
        const shareUrl = window.location.href;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setToast({ message: 'Patient profile link copied to clipboard!', type: 'success' });
        }).catch(err => {
            setToast({ message: 'Failed to copy link.', type: 'error' });
        });
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">

            {/* Direct Printable Content Wrapper (Used for PDF Export) */}
            <div ref={printableRef} className="absolute left-[-9999px] top-0 w-[1000px] bg-white p-10 print:static print:left-0 print:w-full">
                {/* Print Header */}
                <div className="mb-8 border-b-2 border-slate-200 pb-6 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-black uppercase tracking-tight">Official Medical Record</h1>
                        <p className="text-slate-500 mt-1">Generated on: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-black">{user?.firstName} {user?.lastName}</p>
                        <p className="text-slate-500">{user?.email}</p>
                    </div>
                </div>

                {/* Records List for Print */}
                <div className="space-y-6">
                    {filteredRecords.map((record) => {
                        const { bg, icon, tag } = getRecordStyle(record.type);
                        return (
                            <div key={`print-${record.id}`} className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 ${bg.split(' ')[0]} rounded-lg flex items-center justify-center`}>
                                            <span className="material-symbols-outlined text-2xl" style={{ color: 'black' }}>{icon}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-black">{record.title}</h3>
                                            <p className="text-slate-500 text-sm">{formatRecordType(record.type)} • {record.doctor}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-black">
                                            {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                        </p>
                                        <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">{tag}</p>
                                    </div>
                                </div>
                                <div className="pl-16">
                                    <p className="text-slate-700 text-sm leading-relaxed">{record.summary || 'No detailed summary available.'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs italic">
                    This is an electronically generated medical document. Authenticity can be verified via the Medicare Secure Portal.
                </div>
            </div>

            {/* ── Left Sidebar ── */}
            <aside className="print:hidden w-64 glass-card border-r border-white/20 dark:border-white/5 flex flex-col items-center py-8 z-10">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/patient/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>
                <nav className="space-y-2 flex-grow">
                    <Link to="/patient/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/patient/visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Appointments
                    </Link>
                    <Link to="/patient/messages" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                        Messages
                    </Link>
                    <Link to="/patient/medical-records" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                        Records
                    </Link>
                    <Link to="/patient/consent" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        Consents
                    </Link>
                    <Link to="/patient/audit-trail" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Audit Trail
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-grow p-8 overflow-y-auto h-full print:p-0 print:overflow-visible">
                <header className="mb-8 print:hidden">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Medical Records</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your complete health history — private, encrypted, and read-only.</p>
                </header>

                {/* Read-only notice */}
                <div className="print:hidden glass-card rounded-2xl border border-indigo-200/50 dark:border-indigo-800/50 bg-indigo-50/30 dark:bg-indigo-900/10 p-5 mb-6 flex gap-4 items-start">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <span className="material-symbols-outlined">lock</span>
                    </div>
                    <div>
                        <p className="font-bold text-indigo-900 dark:text-indigo-100 text-sm">Read-Only Access</p>
                        <p className="text-indigo-700/80 dark:text-indigo-300/80 text-xs leading-relaxed mt-1">
                            You can view all your medical records. Only authorized healthcare providers can add records. All access is logged for your security.
                        </p>
                    </div>
                </div>

                {/* Search bar and Filter pills */}
                <div className="print:hidden flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-grow">
                        <input
                            className="w-full glass-card border-white/50 dark:border-slate-700/50 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-800 dark:text-slate-100"
                            placeholder="Search in records (titles, summaries, doctors)..."
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="print:hidden flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    {['all', 'consultation', 'diagnosis', 'prescription', 'lab_result', 'imaging', 'procedure', 'note'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === type
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'glass-card text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10 border border-white/50 dark:border-slate-700/50'
                                }`}
                        >
                            {type === 'all' ? 'All Records' : formatRecordType(type)}
                        </button>
                    ))}
                </div>

                {/* Records list */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-medium">Loading medical records...</p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="glass-card rounded-2xl p-16 text-center border border-white/50 dark:border-slate-700/50 flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-3xl text-slate-400">content_paste_off</span>
                            </div>
                            <p className="text-slate-900 dark:text-white font-bold text-lg mb-2">
                                No {filter !== 'all' ? formatRecordType(filter).toLowerCase() + ' ' : ''}records found.
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Medical records appear here after a consultation or procedure.
                            </p>
                        </div>
                    ) : filteredRecords.map((record) => {
                        const isExpanded = expandedRecords.has(record.id);
                        const shouldShowToggle = record.summary && record.summary.length > 150;
                        const { bg, icon, tag } = getRecordStyle(record.type);
                        return (
                            <div
                                key={record.id}
                                className="glass-card rounded-2xl border border-white/50 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-800/50 p-5 transition-all cursor-pointer group"
                                onClick={() => { if (shouldShowToggle) toggleExpand(record.id); }}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                                            <span className="material-symbols-outlined text-2xl">{icon}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{record.title}</h3>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{record.doctor} • {formatRecordType(record.type)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 md:ml-auto">
                                        <div className="hidden sm:block text-right max-w-[200px]">
                                            <p className={`text-sm font-medium text-slate-700 dark:text-slate-300 ${!isExpanded && shouldShowToggle ? 'line-clamp-1' : ''}`}>
                                                {record.summary || 'No summary'}
                                            </p>
                                        </div>
                                        <div className="text-right min-w-[90px]">
                                            <p className="font-bold text-slate-800 dark:text-white text-sm">
                                                {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                            </p>
                                            <p className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wider">{tag}</p>
                                        </div>
                                        <span className={`material-symbols-outlined text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : 'group-hover:translate-x-1'}`}>chevron_right</span>
                                    </div>
                                </div>
                                {isExpanded && record.summary && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 md:pl-16">
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{record.summary}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* ── Right Sidebar ── */}
            <aside className="print:hidden w-72 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 hidden xl:flex flex-col h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Record Insights</h3>
                    <ThemeToggle />
                </div>

                <div className="space-y-3 mb-6">
                    <div className="glass-card rounded-2xl p-4 border border-white/50 dark:border-slate-700/50">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Last Update</p>
                        <p className="text-base font-bold text-slate-800 dark:text-white">
                            {records.length > 0
                                ? new Date(records[0].date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
                                : 'No records yet'}
                        </p>
                        {records.length > 0 && (
                            <p className="text-slate-400 text-xs mt-1">by {records[0].doctor}</p>
                        )}
                    </div>
                    <div className="glass-card rounded-2xl p-4 border border-white/50 dark:border-slate-700/50">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Security Status</p>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <p className="font-bold text-slate-800 dark:text-white text-sm">Encrypted & Secure</p>
                        </div>
                        <p className="text-slate-400 text-xs mt-1">ID: HR-{user?.id?.toString().slice(0, 4) || '0001'}-KM0</p>
                    </div>
                    <div className="glass-card rounded-2xl p-4 border border-white/50 dark:border-slate-700/50">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Records</p>
                        <p className="text-3xl font-bold text-slate-800 dark:text-white">{records.length}</p>
                        <p className="text-slate-400 text-xs mt-1">across {[...new Set(records.map(r => r.type))].length} categories</p>
                    </div>
                </div>

                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { icon: 'download', label: 'Export PDF', action: handleExportPDF },
                        { icon: 'share', label: 'Share', action: handleShare },
                        { icon: 'print', label: 'Print', action: handlePrint },
                        { icon: 'history', label: 'Audit Logs', action: () => navigate('/patient/audit-trail') },
                    ].map(({ icon, label, action }) => (
                        <button
                            key={label}
                            onClick={action}
                            className="p-4 glass-card rounded-2xl border border-white/50 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-indigo-500">{icon}</span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
                        </button>
                    ))}
                </div>

                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </aside>
        </div>
    );
}

export default MedicalRecords;
