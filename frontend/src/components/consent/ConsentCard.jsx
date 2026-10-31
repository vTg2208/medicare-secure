import React from 'react';
import './ConsentCard.css';
function ConsentCard({ consent, onRevoke, onEdit }) {
    const formatDate = (dateString) => {
        if (!dateString) return 'No expiry';
        // Parse UTC string and display in local time
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Correctly check expiry using timestamps
    const getIsExpired = () => {
        if (!consent.endTime) return false;
        return new Date(consent.endTime).getTime() < new Date().getTime();
    };

    // Check active status based on database status + expiry check
    const isExpired = getIsExpired();
    // Also consider backend's isActive flag if available, for double verification
    const isActive = (consent.status?.toUpperCase() === 'ACTIVE') && !isExpired;
    const formatCategory = (category) => {
        const categories = {
            'all_medical_data': 'All Medical Data',
            'diagnoses': 'Diagnoses Only',
            'prescriptions': 'Prescriptions Only',
            'lab_results': 'Lab Results Only',
            'imaging': 'Imaging Reports Only',
            'vital_signs': 'Vitals Only',
            'clinical_notes': 'Clinical Notes',
            'allergies': 'Allergies',
            'immunizations': 'Immunizations',
            'procedures': 'Procedures'
        };
        return categories[category] || category;
    };

    const formatPurpose = (purpose) => {
        const purposes = {
            'treatment': 'Treatment',
            'consultation': 'Consultation',
            'second_opinion': 'Second Opinion',
            'clinical_research': 'Research (Anonymized)',
            'medical_study': 'Medical Study',
            'active': 'Active',
            'revoked': 'Revoked',
            'expired': 'Expired'
        };
        return purposes[purpose] || purpose.charAt(0).toUpperCase() + purpose.slice(1).replace(/_/g, ' ');
    };

    const formatAccess = (access) => {
        return access === 'write' ? 'Read & Write' : 'Read Only';
    };

    const [remainingTime, setRemainingTime] = React.useState('');

    React.useEffect(() => {
        if (!consent.endTime) {
            setRemainingTime('Indefinite (Unlimited)');
            return;
        }

        const updateTimer = () => {
            const now = new Date();
            const end = new Date(consent.endTime);
            const total = end.getTime() - now.getTime();

            if (total <= 0) {
                setRemainingTime('Expired');
                return;
            }

            // const days = Math.floor(total / (1000 * 60 * 60 * 24));
            const totalHours = Math.floor(total / (1000 * 60 * 60)); // Total hours remaining
            const minutes = Math.floor((total / 1000 / 60) % 60);
            const seconds = Math.floor((total / 1000) % 60);

            // If days > 0, we can still show them, or just show total hours as requested.
            // User said: "if i give 25hrs, it says 6hrs remaing. fix that too."
            // This implies they want to see "25h ..." or accurate total time.
            // Since we removed "days" input, let's show total hours if it's less than say 48h, or just stick to a clean format.
            // Let's use a composite format: "Xh Ym Zs" where X is total hours.

            setRemainingTime(`${totalHours}h ${minutes}m ${seconds}s remaining`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [consent.endTime]);

    return (
        <div className={`glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group relative overflow-hidden ${isExpired ? 'opacity-80' : ''}`}>
            <div className="flex justify-between items-start mb-6 border-b border-gray-100/50 dark:border-slate-700/50 pb-4">
                <div>
                    <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">{consent.recipientName}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{consent.specialization}</p>
                </div>
                <div className="flex flex-col items-end">
                    <span className={`px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg truncate max-w-[120px] shadow-sm uppercase ${isExpired ? 'bg-slate-400' :
                            isActive ? 'bg-indigo-600' :
                                'bg-red-500'
                        }`}>
                        {isExpired ? 'EXPIRED' : consent.status}
                    </span>
                    {isActive && consent.endTime && (
                        <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 mt-2 text-right">
                            {remainingTime}
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10 mb-4 space-y-3">
                <div className="flex justify-between items-center sm:grid sm:grid-cols-3 sm:gap-4">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Data Category</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white text-right sm:col-span-2">{formatCategory(consent.dataCategory)}</span>
                </div>

                <div className="flex justify-between items-center sm:grid sm:grid-cols-3 sm:gap-4">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Purpose</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white text-right sm:col-span-2">{formatPurpose(consent.purpose)}</span>
                </div>

                <div className="flex justify-between items-center sm:grid sm:grid-cols-3 sm:gap-4">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Access Level</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white text-right sm:col-span-2">{formatAccess(consent.accessLevel)}</span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mt-2">
                <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span>From: {formatDate(consent.startTime)}</span>
                    <span className={`${isExpired ? 'text-red-500 dark:text-red-400' : ''}`}>
                        To: {formatDate(consent.endTime)}
                    </span>
                </div>

                {isActive && (
                    <div className="flex items-center gap-2">
                        <button
                            className="px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-xs font-bold rounded-lg transition-colors shadow-sm"
                            onClick={() => onEdit(consent)}
                        >
                            Edit
                        </button>
                        <button
                            className="px-4 py-2 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold rounded-lg transition-colors shadow-sm"
                            onClick={() => onRevoke(consent.id)}
                        >
                            Revoke
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConsentCard;
