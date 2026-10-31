import Brand from '../../components/common/Brand';
import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import ThemeToggle from '../../components/common/ThemeToggle';
import { visitApi } from '../../api/visitApi';
import '../patient/Dashboard.css';

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    pending: { label: 'Pending', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-500' },
    approved: { label: 'Approved', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
    checked_in: { label: 'Arrived', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300', dot: 'bg-indigo-500' },
    in_progress: { label: 'In Consult', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-300', dot: 'bg-teal-500' },
    completed: { label: 'Completed', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500' },
    cancelled: { label: 'Cancelled', color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-300', dot: 'bg-rose-500' },
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-slate-600 bg-slate-100', dot: 'bg-slate-400' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
};

// ─── Today's date range helper ─────────────────────────────────────────────────
const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
};

// ─── Main Component ────────────────────────────────────────────────────────────
function StaffDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);

    const [visits, setVisits] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [visitsRes, doctorsRes] = await Promise.allSettled([
                visitApi.getHospitalVisits(),
                visitApi.getStaffByRole('doctor'),
            ]);

            if (visitsRes.status === 'fulfilled') {
                const raw = visitsRes.value?.data || visitsRes.value || [];
                setVisits(Array.isArray(raw) ? raw : []);
            }
            if (doctorsRes.status === 'fulfilled') {
                const raw = doctorsRes.value?.data || doctorsRes.value || [];
                setDoctors(Array.isArray(raw) ? raw : []);
            }
        } catch (err) {
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // ── Queue: only actionable statuses ──────────────────────────────────────
    const queueVisits = visits.filter(v =>
        ['pending', 'approved', 'checked_in', 'in_progress'].includes(v.status)
    ).slice(0, 10);

    // ── Today's stats ─────────────────────────────────────────────────────────
    const todayVisits = visits.filter(v => isToday(v.created_at || v.requested_at));
    const stats = {
        newRegistrations: todayVisits.length,
        appointments: visits.filter(v => v.status === 'approved').length,
        consultationsDone: visits.filter(v => v.status === 'completed' && isToday(v.updated_at)).length,
        pendingVisits: visits.filter(v => v.status === 'pending').length,
    };

    // ── Doctor availability derived from active visits ─────────────────────────
    const busyDoctorIds = new Set(
        visits.filter(v => v.status === 'in_progress').map(v => v.doctor_id || v.doctorId)
    );
    const doctorPanel = doctors.map(d => ({
        ...d,
        availability: busyDoctorIds.has(d.id || d.user_id) ? 'In Consultation' : 'Available',
    }));

    // ── Status transition helpers ─────────────────────────────────────────────
    const NEXT_STATUS = {
        pending: { label: 'Mark Arrived', nextStatus: 'checked_in', color: 'bg-indigo-500 hover:bg-indigo-600' },
        approved: { label: 'Mark Arrived', nextStatus: 'checked_in', color: 'bg-indigo-500 hover:bg-indigo-600' },
        checked_in: { label: 'Start Consultation', nextStatus: 'in_progress', color: 'bg-teal-500 hover:bg-teal-600' },
        in_progress: { label: 'Mark Completed', nextStatus: 'completed', color: 'bg-emerald-500 hover:bg-emerald-600' },
    };

    const handleTransition = async (visit) => {
        const cfg = NEXT_STATUS[visit.status];
        if (!cfg) return;
        setUpdatingId(visit.id);
        try {
            await visitApi.updateVisit(visit.id, { status: cfg.nextStatus });
            await fetchData();
        } catch (err) {
        } finally {
            setUpdatingId(null);
        }
    };

    const navToVisits = () => {
        if (user?.role === 'receptionist' || user?.roleName === 'receptionist') {
            navigate('/receptionist/visits');
        } else {
            navigate('/staff/visit-queue');
        }
    };

    // ─── Sidebar items ──────────────────────────────────────────────────────────
    const sidebarLinks = [
        { to: '/staff/dashboard', icon: 'grid_view', label: 'Overview', active: true },
        { onClick: navToVisits, icon: 'fact_check', label: 'Visit Management' },
        { to: '/staff/registration', icon: 'person_add', label: 'Patient Registration' },
        { to: '/staff/workflow', icon: 'health_and_safety', label: 'Clinical Workflow' },
    ];

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme"><ThemeToggle /></div>

            {/* ── Sidebar ── */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 mc-sidebar">
                <Brand to={'/staff/dashboard'} />

                <nav className="space-y-2 flex-grow">
                    {sidebarLinks.map((item, i) => {
                        const cls = item.active
                            ? 'flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800 shadow-sm'
                            : 'w-full flex items-center justify-start gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl';
                        if (item.to) {
                            return <Link key={i} to={item.to} className={cls}><span className="material-symbols-outlined text-[20px]">{item.icon}</span>{item.label}</Link>;
                        }
                        return <button key={i} onClick={item.onClick} className={cls}><span className="material-symbols-outlined text-[20px]">{item.icon}</span>{item.label}</button>;
                    })}
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <button onClick={logout} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main ── */}
            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">

                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Receptionist Dashboard</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Patient Flow &amp; Visit Management</p>
                        </div>
                        <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            </div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {user?.firstName} {user?.lastName} · On Duty
                            </span>
                        </div>
                    </div>

                    {/* ── Top 4 Quick-Action Cards ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { onClick: navToVisits, icon: 'fact_check', color: "primary", title: 'Visit Management', sub: 'Patient Queue & Approval', desc: 'Track Consultations' },
                            { to: '/staff/registration', icon: 'person_add', color: "primary", title: 'Patient Registration', sub: 'Demographics & Insurance', desc: 'New Profiles' },
                            { onClick: () => { if (user?.role === 'receptionist') navigate('/receptionist/visits#schedule'); }, icon: 'event_available', color: "primary", title: 'Appointment Scheduling', sub: 'Manage time slots', desc: 'Doctor Calendar' },
                            { to: '/staff/workflow', icon: 'health_and_safety', color: "primary", title: 'Clinical Workflow', sub: 'Visits & Beds Manager', desc: 'Triage & IPD' },
                        ].map((card, i) => {
                            const Wrapper = card.to ? Link : 'div';
                            const props = card.to ? { to: card.to } : { onClick: card.onClick };
                            return (
                                <Wrapper key={i} {...props} className={`glass-card p-6 rounded-3xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all cursor-pointer group block`}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className={`w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400`}>
                                            <span className="material-symbols-outlined text-2xl">{card.icon}</span>
                                        </div>
                                        <span className={`material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors`}>arrow_forward</span>
                                    </div>
                                    <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">{card.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">{card.desc}</p>
                                    <div className={`bg-primary-50/50 dark:bg-primary-900/20 p-4 rounded-2xl border border-primary-100/50 dark:border-primary-500/10`}>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{card.sub}</span>
                                    </div>
                                </Wrapper>
                            );
                        })}
                    </div>
                </header>

                {/* ── Widget Row ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-2">

                    {/* ── Widget 1: Live Patient Queue (spans 2 cols) ── */}
                    <div className="xl:col-span-2 glass-card rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[20px] text-primary-500">groups</span>
                                    Live Patient Queue
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Active visits requiring attention</p>
                            </div>
                            <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" title="Refresh">
                                <span className="material-symbols-outlined text-[18px]">refresh</span>
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-40 text-slate-400">
                                <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                            </div>
                        ) : queueVisits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                                <span className="material-symbols-outlined text-4xl">inbox</span>
                                <p className="text-sm">No active visits right now</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left pb-3 font-semibold text-slate-500 dark:text-slate-400 pr-4">Token</th>
                                            <th className="text-left pb-3 font-semibold text-slate-500 dark:text-slate-400 pr-4">Patient</th>
                                            <th className="text-left pb-3 font-semibold text-slate-500 dark:text-slate-400 pr-4">Doctor</th>
                                            <th className="text-left pb-3 font-semibold text-slate-500 dark:text-slate-400 pr-4">Status</th>
                                            <th className="text-right pb-3 font-semibold text-slate-500 dark:text-slate-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {queueVisits.map(v => {
                                            const next = NEXT_STATUS[v.status];
                                            const patientName = v.patient_first_name
                                                ? `${v.patient_first_name} ${v.patient_last_name}`
                                                : v.patientName || '—';
                                            const doctorName = v.doctor_first_name
                                                ? `Dr. ${v.doctor_first_name} ${v.doctor_last_name}`
                                                : v.doctorName || 'Unassigned';
                                            return (
                                                <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-3 pr-4">
                                                        <span className="font-mono font-bold text-primary-600 dark:text-primary-400 text-xs">
                                                            {(v.visit_code || v.visitCode || v.id?.slice(0, 8) || '—').toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">{patientName}</td>
                                                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{doctorName}</td>
                                                    <td className="py-3 pr-4"><StatusBadge status={v.status} /></td>
                                                    <td className="py-3 text-right">
                                                        {next && (
                                                            <button
                                                                onClick={() => handleTransition(v)}
                                                                disabled={updatingId === v.id}
                                                                className={`px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-colors ${next.color} disabled:opacity-50`}
                                                            >
                                                                {updatingId === v.id ? '...' : next.label}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── Widget 2: Doctor Availability ── */}
                    <div className="glass-card rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="mb-5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px] text-primary-500">stethoscope</span>
                                Doctor Availability
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time status</p>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-40 text-slate-400">
                                <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                            </div>
                        ) : doctorPanel.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                                <span className="material-symbols-outlined text-4xl">no_accounts</span>
                                <p className="text-sm">No doctors found</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {doctorPanel.map((doc, i) => {
                                    const name = doc.first_name
                                        ? `Dr. ${doc.first_name} ${doc.last_name}`
                                        : doc.name || `Doctor ${i + 1}`;
                                    const isAvailable = doc.availability === 'Available';
                                    return (
                                        <div key={doc.id || i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${isAvailable ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300" : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                                    {name.charAt(4) || 'D'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{doc.specialization || doc.specialty || 'General'}</p>
                                                </div>
                                            </div>
                                            <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${isAvailable ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? "bg-primary-500" : 'bg-amber-500 animate-pulse'}`} />
                                                {doc.availability}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Widget 3: Today's Statistics ── */}
                <div className="mt-6 glass-card rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                        <span className="material-symbols-outlined text-[20px] text-primary-500">bar_chart</span>
                        Today's Activity
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* New Registrations — Indigo */}
                        <div className="p-5 rounded-2xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                <span className="material-symbols-outlined text-[20px]">person_add</span>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{loading ? '—' : stats.newRegistrations}</p>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">New Registrations</p>
                            </div>
                        </div>

                        {/* Appointments — Blue */}
                        <div className="p-5 rounded-2xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                <span className="material-symbols-outlined text-[20px]">event_available</span>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{loading ? '—' : stats.appointments}</p>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Appointments</p>
                            </div>
                        </div>

                        {/* Consultations Done — Emerald */}
                        <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{loading ? '—' : stats.consultationsDone}</p>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Consultations Done</p>
                            </div>
                        </div>

                        {/* Pending Visits — Amber */}
                        <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <span className="material-symbols-outlined text-[20px]">pending</span>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{loading ? '—' : stats.pendingVisits}</p>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Pending Visits</p>
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}

export default StaffDashboard;
