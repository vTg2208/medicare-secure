import React, { useState, useMemo } from 'react';
import { getDoctorMockImage } from '../../utils/mockImages';

const DoctorSelectionPopup = ({ doctors, onClose, onSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedDoctorId, setSelectedDoctorId] = useState(null);

    // Extract unique categories (specializations) from doctors list
    const categories = useMemo(() => {
        const specializations = doctors.map(d => d.specialization?.trim() || 'General');
        const uniqueCategories = ['All', ...new Set(specializations)].filter(Boolean);
        return uniqueCategories;
    }, [doctors]);

    // Filter doctors based on search and category
    const filteredDoctors = useMemo(() => {
        return doctors.filter(doctor => {
            const matchesCategory = selectedCategory === 'All' || (doctor.specialization?.trim() || 'General') === selectedCategory;
            const searchTerm = searchQuery.toLowerCase();
            const fullName = `Dr. ${doctor.firstName} ${doctor.lastName}`.toLowerCase();
            const spec = (doctor.specialization || 'General').toLowerCase();

            const matchesSearch = fullName.includes(searchTerm) || spec.includes(searchTerm);
            return matchesCategory && matchesSearch;
        });
    }, [doctors, selectedCategory, searchQuery]);

    const handleContinue = () => {
        const doc = doctors.find(d => d.id === selectedDoctorId);
        if (doc) onSelect(doc);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-slate-900/50 backdrop-blur-sm">
            <style>{`
                .doctor-card:hover .doctor-image {
                    transform: scale(1.05);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
                .animate-bounce-in {
                    animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes bounce-in {
                    0% { transform: scale(0); }
                    100% { transform: scale(1); }
                }
            `}</style>

            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-800">

                {/* Header */}
                <header className="p-6 md:px-10 flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-[#66D1A1] rounded-xl flex items-center justify-center text-white">
                            <span className="material-symbols-outlined">medical_services</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-white">Select Doctor</h1>
                    </div>

                    <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors inline-flex">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                {/* Filters */}
                <div className="px-6 md:px-10 pb-6 pt-6 shrink-0">
                    <div className="flex items-center gap-3 overflow-x-auto pb-4 custom-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`whitespace-nowrap px-6 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat
                                    ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg shadow-slate-200 dark:shadow-none'
                                    : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="relative w-full md:w-96">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                            <input
                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl appearance-none text-sm text-slate-600 dark:text-slate-300 focus:ring-[#66D1A1] focus:border-[#66D1A1] transition-all outline-none"
                                placeholder="Search doctor or category"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Doctors List */}
                <main className="flex-1 overflow-y-auto px-6 md:px-10 pb-10 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredDoctors.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-3 opacity-50">search_off</span>
                                <p className="text-sm">No doctors found matching your criteria.</p>
                            </div>
                        ) : (
                            filteredDoctors.map(doctor => {
                                const isSelected = selectedDoctorId === doctor.id;
                                return (
                                    <div
                                        key={doctor.id}
                                        onClick={() => setSelectedDoctorId(doctor.id)}
                                        className={`doctor-card group rounded-[2rem] p-5 cursor-pointer border-2 transition-all hover:shadow-xl ${isSelected
                                            ? 'bg-[#F2FAF6] dark:bg-[#1E293B] border-[#66D1A1]/50 shadow-[#66D1A1]/10'
                                            : 'bg-slate-50 dark:bg-slate-800/40 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                                            }`}
                                    >
                                        <div className="relative mb-6 overflow-hidden rounded-2xl aspect-[4/5] bg-white dark:bg-slate-800 flex items-center justify-center">
                                            <img alt={`Dr. ${doctor.firstName} ${doctor.lastName}`} className="doctor-image w-full h-full object-cover transition-transform duration-500" src={doctor.profileImage || getDoctorMockImage(doctor.id)} />

                                            {isSelected && (
                                                <div className="absolute top-3 right-3 w-8 h-8 bg-[#66D1A1] rounded-full flex items-center justify-center shadow-lg transform transition-transform animate-bounce-in">
                                                    <span className="material-symbols-outlined text-white text-[18px]">check</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Dr. {doctor.firstName} {doctor.lastName}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{doctor.specialization || 'General'}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </main>

                {/* Footer */}
                <footer className="p-6 md:px-10 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {filteredDoctors.length} specialist{filteredDoctors.length !== 1 ? 's' : ''} found
                    </p>
                    <button
                        onClick={handleContinue}
                        disabled={!selectedDoctorId}
                        className="w-full sm:w-auto px-8 py-3 bg-[#66D1A1] hover:brightness-105 disabled:bg-slate-200 disabled:dark:bg-slate-800 text-white disabled:text-slate-400 font-semibold rounded-2xl transition-all shadow-lg shadow-[#66D1A1]/20 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        Continue
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default DoctorSelectionPopup;
