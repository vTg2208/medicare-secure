import React, { useState, useMemo } from 'react';
import { getDoctorMockImage } from '../../utils/mockImages';

const DoctorProfilePopup = ({ doctor, onBack, onBook }) => {

    const dateInputRef = React.useRef(null);

    // Setup initial state for a 14-day rolling window
    const [startDate, setStartDate] = useState(new Date());
    const [selectedDateObj, setSelectedDateObj] = useState(new Date()); // default to today
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

    // Generate the 14-day rolling window data based on `startDate`
    const dates = useMemo(() => {
        const dArr = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < 14; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);

            // For a realistic clinic, assume weekends are closed (can adjust as needed)
            if (date.getDay() === 0 || date.getDay() === 6) {
                // Skip weekends
                continue;
            }

            dArr.push({
                day: days[date.getDay()],
                num: date.getDate(),
                fullDate: date,
                isPast: date < new Date(new Date().setHours(0, 0, 0, 0))
            });
        }
        return dArr;
    }, [startDate]);

    // Mock dynamic time slots based on the selected date to make it look "live"
    const timeSlots = useMemo(() => {
        if (!selectedDateObj) return [];
        // A simple deterministic hash based on date string to always show the same slots for the same day
        const seed = selectedDateObj.getDate() + selectedDateObj.getMonth();

        const allSlots = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"];

        // Randomly hide a few slots (simulating booked appointments)
        return allSlots.filter((_, idx) => (seed + idx) % 5 !== 0).slice(0, 9); // limit to 9 for layout
    }, [selectedDateObj]);

    // Format date specifically for the input standard YYYY-MM-DD
    const formatDateForInput = (date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    };

    if (!doctor) return null;

    const handleDateSelect = (dateObj) => {
        if (!dateObj.isPast) {
            setSelectedDateObj(dateObj.fullDate);
            setSelectedTimeSlot(null); // Reset time when date changes
        }
    };

    const handleCalendarChange = (e) => {
        const newDate = new Date(e.target.value);
        // Add timezone offset correction to avoid day-before shifts
        const correctedDate = new Date(newDate.getTime() + Math.abs(newDate.getTimezoneOffset() * 60000));

        if (correctedDate >= new Date(new Date().setHours(0, 0, 0, 0))) {
            setStartDate(correctedDate);
            setSelectedDateObj(correctedDate);
            setSelectedTimeSlot(null);
        }
    };

    const handleViewCalendarClick = () => {
        if (dateInputRef.current && typeof dateInputRef.current.showPicker === 'function') {
            try {
                dateInputRef.current.showPicker();
            } catch (err) {
                // Ignore fallback for unsupported browsers
            }
        }
    };

    const handleBook = () => {
        if (selectedDateObj && selectedTimeSlot) {
            onBook({
                doctorId: doctor.id,
                date: formatDateForInput(selectedDateObj),
                time: selectedTimeSlot
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex flex-col w-full h-full bg-slate-50 dark:bg-[#102219] overflow-hidden backdrop-blur-md">
            {/* Top Navigation */}
            <div className="sticky top-0 z-50 flex items-center bg-slate-50/80 dark:bg-[#102219]/80 backdrop-blur-md px-4 py-3 justify-between">
                <button
                    onClick={onBack}
                    className="text-slate-900 dark:text-slate-100 flex h-10 w-10 shrink-0 items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition"
                >
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Doctor Profile</h2>
                <div className="flex w-10 items-center justify-end">
                    <button className="text-slate-900 dark:text-slate-100">
                        <span className="material-symbols-outlined">favorite_border</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-40" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {/* Doctor Identity */}
                <div className="flex p-6">
                    <div className="flex w-full flex-col gap-5 items-center">
                        <div className="relative">
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-xl shadow-lg border-4 border-white dark:border-slate-800 min-h-40 w-40 flex items-center justify-center bg-slate-200 dark:bg-slate-700 overflow-hidden"
                                style={{ backgroundImage: `url(${doctor.profileImage || getDoctorMockImage(doctor.id)})` }}
                            >
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-emerald-400 p-1.5 rounded-full shadow-md flex items-center justify-center border-2 border-white dark:border-slate-800">
                                <span className="material-symbols-outlined text-white text-sm">verified</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <p className="text-slate-900 dark:text-slate-100 text-2xl font-bold leading-tight tracking-[-0.015em] text-center">Dr. {doctor.firstName} {doctor.lastName}</p>
                            <p className="text-emerald-500 font-semibold text-base leading-normal text-center capitalize">{doctor.specialization || 'General'}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="material-symbols-outlined text-amber-400 fill-amber-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                <span className="text-slate-600 dark:text-slate-400 text-sm font-medium">4.8 (1.2k reviews)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-3 px-4">
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl p-4 bg-emerald-400/10 border border-emerald-400/20">
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Experience</p>
                        <p className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight whitespace-nowrap">10+ Years</p>
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl p-4 bg-emerald-400/10 border border-emerald-400/20">
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Patients</p>
                        <p className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight whitespace-nowrap">2.5k+</p>
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl p-4 bg-emerald-400/10 border border-emerald-400/20">
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Rating</p>
                        <p className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight whitespace-nowrap">4.8 Stars</p>
                    </div>
                </div>

                {/* Biography Section */}
                <div className="px-4 py-6">
                    <h3 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-[-0.015em] pb-3">Biography</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium leading-relaxed">
                        Dr. {doctor.firstName} {doctor.lastName} is a highly experienced {doctor.specialization || 'Specialist'} with over 10 years of practice. Dedicated to providing compassionate, evidence-based care tailored to each patient's unique needs. Actively involved in ongoing medical research and continuously adapting to the newest practices.
                    </p>
                </div>

                {/* Availability Section */}
                <div className="px-4 pb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight tracking-[-0.015em]">Availability</h3>
                        <div className="relative">
                            <button
                                onClick={handleViewCalendarClick}
                                className="text-emerald-500 text-sm font-semibold flex items-center gap-1 hover:text-emerald-600 transition"
                            >
                                <span className="material-symbols-outlined text-sm">calendar_month</span>
                                View Calendar
                            </button>
                            <input
                                type="date"
                                className="absolute right-0 top-0 opacity-0 w-full h-full cursor-pointer"
                                min={formatDateForInput(new Date())}
                                onChange={handleCalendarChange}
                                ref={dateInputRef}
                                style={{ visibility: 'hidden' }} // Keep it hidden but accessible to the UI gesture logic in standard DOM
                            />
                        </div>
                    </div>

                    {/* Date Selector */}
                    <div className="flex gap-3 overflow-x-auto pb-4 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {dates.map((d, index) => {
                            const isSelected = selectedDateObj && (d.fullDate.toDateString() === selectedDateObj.toDateString());
                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDateSelect(d)}
                                    className={`flex flex-col items-center justify-center min-w-[64px] h-20 rounded-xl transition-all ${d.isPast
                                        ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed border border-transparent'
                                        : isSelected
                                            ? 'bg-emerald-400 text-slate-900 shadow-lg transform scale-105 ring-4 ring-emerald-400/20 cursor-pointer'
                                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                                        }`}
                                >
                                    <p className="text-xs font-medium">{d.day}</p>
                                    <p className="text-lg font-bold">{d.num}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time Slots */}
                    {selectedDateObj && (
                        <div className="mt-4">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                Available Times on {selectedDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                {timeSlots.map((time, idx) => {
                                    const isSelected = selectedTimeSlot === time;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedTimeSlot(time)}
                                            className={`py-3 px-2 rounded-lg font-medium text-sm text-center transition-all ${isSelected
                                                ? 'bg-emerald-400/20 border border-emerald-400 text-emerald-700 dark:text-emerald-400 shadow-sm ring-2 ring-emerald-400/30'
                                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300'
                                                }`}
                                        >
                                            {time}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Footer Action */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-[#102219]/90 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 p-4 pb-8 z-50">
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex flex-col">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">Consultation Fee</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">$120.00</p>
                    </div>
                    <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#102219] bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">JD</div>
                        <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#102219] bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">AS</div>
                        <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#102219] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-400">+12</div>
                    </div>
                </div>
                <button
                    onClick={handleBook}
                    disabled={!selectedDateObj || !selectedTimeSlot}
                    className="w-full bg-emerald-400 hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700/50 disabled:text-slate-500 text-slate-900 font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">calendar_today</span>
                    {(!selectedDateObj || !selectedTimeSlot) ? 'Select Date & Time' : 'Book Appointment'}
                </button>
            </div>
        </div>
    );
};

export default DoctorProfilePopup;
