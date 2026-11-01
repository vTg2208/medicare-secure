const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5003;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000', // Allow frontend origin
    credentials: true,
}));
app.use(express.json());

// --- Mock Data ---
const MOCK_USER = {
    id: "a1dadc55-3fb1-4082-a04d-00a6d1ff9349",
    email: "patient@medicare.com",
    role: "PATIENT",
    firstName: "John",
    lastName: "Doe"
};

const MOCK_TOKEN = (process.env.LEGACY_API_TOKEN || '');

// --- Endpoints ---

// 1. Health Check
app.get('/health', (req, res) => {
    res.json({
        status: "UP",
        database: "MOCKED",
        version: "1.0.0-mock"
    });
});

// 2. Public Stats
app.get('/public/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            hospitalsCount: 42,
            patientsManaged: 15420
        }
    });
});

// 3. Register Patient
app.post('/api/v1/auth/register/patient', (req, res) => {
    const { email } = req.body;
    // Simulate sending an OTP
    res.json({
        success: true,
        message: `OTP sent to ${email}`
    });
});

// 4. Verify OTP
app.post('/api/v1/auth/otp/verify', (req, res) => {
    // Just accept any OTP
    res.json({
        success: true,
        message: 'OTP verified successfully'
    });
});

// 5. Login
app.post('/api/v1/auth/login', (req, res) => {
    const { emailOrPhone, password } = req.body;
    
    if (emailOrPhone === 'nurse@medicare.com') {
        const MOCK_NURSE = {
            id: "nurse-123",
            email: "nurse@medicare.com",
            role: "NURSE",
            firstName: "Sarah",
            lastName: "Jenkins"
        };
        return res.json({
            success: true,
            data: {
                user: MOCK_NURSE,
                accessToken: MOCK_TOKEN
            }
        });
    }

    if (emailOrPhone === 'radiologist@medicare.com') {
        const MOCK_RAD = {
            id: "rad-789",
            email: "radiologist@medicare.com",
            role: "radiologist",
            firstName: "David",
            lastName: "Chen"
        };
        return res.json({
            success: true,
            data: {
                user: MOCK_RAD,
                accessToken: MOCK_TOKEN
            }
        });
    }

    if (emailOrPhone === 'pharmacist@medicare.com') {
        const MOCK_PHARM = {
            id: "pharm-456",
            email: "pharmacist@medicare.com",
            role: "pharmacist",
            firstName: "Aisha",
            lastName: "Patel"
        };
        return res.json({
            success: true,
            data: {
                user: MOCK_PHARM,
                accessToken: MOCK_TOKEN
            }
        });
    }

    if (emailOrPhone === 'compliance@medicare.com') {
        const MOCK_COMP_OFFICER = {
            id: "comp-999",
            email: "compliance@medicare.com",
            role: "COMPLIANCE_OFFICER",
            firstName: "Robert",
            lastName: "Oppenheimer"
        };
        return res.json({
            success: true,
            data: {
                user: MOCK_COMP_OFFICER,
                accessToken: MOCK_TOKEN
            }
        });
    }

    if (emailOrPhone === 'agent@bluecross.com') {
        const MOCK_INSURANCE_AGENT = {
            id: "ins-202",
            email: "agent@bluecross.com",
            role: "INSURANCE",
            firstName: "Sarah",
            lastName: "Jenkins"
        };
        return res.json({
            success: true,
            data: {
                user: MOCK_INSURANCE_AGENT,
                accessToken: MOCK_TOKEN
            }
        });
    }

    if (emailOrPhone === 'researcher@medicare.com') {
        const MOCK_RESEARCHER = {
            id: "res-303",
            email: "researcher@medicare.com",
            role: "RESEARCHER",
            firstName: "Dr. Emily",
            lastName: "Stanton"
        };
        return res.json({
            success: true,
            data: {
                user: MOCK_RESEARCHER,
                accessToken: MOCK_TOKEN
            }
        });
    }
    
    // Accept any password for mock user
    if (emailOrPhone === 'patient@medicare.com' || emailOrPhone === 'test@test.com') {
        return res.json({
            success: true,
            data: {
                user: { ...MOCK_USER, email: emailOrPhone },
                accessToken: MOCK_TOKEN
            }
        });
    }

    // Default generic success for testing
    return res.json({
        success: true,
        data: {
            user: { ...MOCK_USER, email: emailOrPhone },
            accessToken: MOCK_TOKEN
        }
    });
});

// 6. Passkey Login Options
app.post('/api/v1/auth/passkey/login/options', (req, res) => {
    const { email } = req.body;
    
    // Return mock SimpleWebAuthn options
    res.json({
        success: true,
        data: {
            challenge: "mock-options-challenge-string",
            timeout: 60000,
            rpId: "localhost",
            allowCredentials: [],
            userVerification: "preferred"
        }
    });
});

// 7. Passkey Login Verify
app.post('/api/v1/auth/passkey/login/verify', (req, res) => {
    const { email, credential } = req.body;

    // Just accept any credential for the mock
    res.json({
        success: true,
        data: {
            user: { ...MOCK_USER, email: email },
            accessToken: MOCK_TOKEN
        }
    });
});

// 8. Verify Session (Mock endpoint for frontend startup)
app.get('/api/v1/auth/verify', (req, res) => {
    // Determine user role from frontend mock data headers if we wanted to be fancy
    // But for now, we'll just check if they are trying to access nurse routes (via referer or we can just return the nurse user if we know they want it)
    // Actually, to make it easy to test both, let's look at a custom header or just default to patient
    // For this mock, returning MOCK_USER is fine for patient, but if they logged in as nurse, they'd want the nurse profile.
    // A quick hack for the mock: if referer contains 'nurse', return nurse profile.
    let userToReturn = MOCK_USER;
    const referer = req.headers.referer || '';
    if (referer.includes('nurse')) {
        userToReturn = {
            id: "nurse-123",
            email: "nurse@medicare.com",
            role: "NURSE",
            firstName: "Sarah",
            lastName: "Jenkins"
        };
    } else if (referer.includes('radiology')) {
        userToReturn = {
            id: "rad-789",
            email: "radiologist@medicare.com",
            role: "radiologist",
            firstName: "David",
            lastName: "Chen"
        };
    } else if (referer.includes('pharmacist')) {
        userToReturn = {
            id: "pharm-456",
            email: "pharmacist@medicare.com",
            role: "pharmacist",
            firstName: "Aisha",
            lastName: "Patel"
        };
    } else if (referer.includes('researcher')) {
        userToReturn = {
            id: "res-303",
            email: "researcher@medicare.com",
            role: "RESEARCHER",
            firstName: "Dr. Emily",
            lastName: "Stanton"
        };
    }

    // If authorization header exists, verify success
    if (req.headers.authorization) {
        return res.json({
            success: true,
            data: {
                user: userToReturn
            }
        });
    }
    return res.status(401).json({ success: false, message: "Unauthorized" });
});

app.get('/api/v1/visits/hospital', (req, res) => {
    res.json({ success: true, data: [] });
});

app.get('/api/v1/visits/my-visits', (req, res) => {
    // Return some mock visits to show in Visits.jsx
    res.json({
        success: true,
        data: [
            {
                id: 'visit-1',
                visit_code: '123456',
                organization_name: 'Medicare General Hospital',
                doctor_first_name: 'Sarah',
                doctor_last_name: 'Smith',
                reason: 'Regular Checkup',
                scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                status: 'scheduled'
            },
            {
                id: 'visit-2',
                visit_code: '789012',
                organization_name: 'Medicare General Hospital',
                doctor_first_name: 'John',
                doctor_last_name: 'Doe',
                reason: 'Follow-up',
                scheduled_time: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
                status: 'completed'
            }
        ]
    });
});

app.post('/api/v1/visits/request', (req, res) => {
    // Basic verification without real auth logic for the mock
    res.json({
        success: true,
        data: MOCK_USER
    });
});

app.post('/api/v1/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});

// ── User Profile ──
app.get('/api/v1/users/profile', (req, res) => {
    res.json({
        success: true,
        data: {
            user: {
                id: MOCK_USER.id,
                firstName: MOCK_USER.firstName,
                lastName: MOCK_USER.lastName,
                email: MOCK_USER.email,
                phone: '+1 234 567 890',
                role: MOCK_USER.role,
                status: 'active'
            }
        }
    });
});

app.put('/api/v1/users/profile', (req, res) => {
    const { firstName, lastName, phone } = req.body;
    res.json({
        success: true,
        data: {
            id: MOCK_USER.id,
            firstName: firstName || MOCK_USER.firstName,
            lastName: lastName || MOCK_USER.lastName,
            email: MOCK_USER.email,
            phone: phone || '+1 234 567 890'
        }
    });
});

// ── Consent ──
const MOCK_CONSENTS = [
    {
        id: 'consent-1',
        hospitalId: 'hosp-123',
        hospitalName: 'Medicare General Hospital',
        doctorName: 'Dr. Sarah Smith',
        grantedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
        status: 'active',
        permissions: [
            { recordType: 'Consultation', accessLevel: 'read' },
            { recordType: 'Lab Results', accessLevel: 'read & write' }
        ]
    }
];

app.get('/api/v1/consent/active', (req, res) => {
    res.json(MOCK_CONSENTS.filter(c => c.status === 'active'));
});

app.get('/api/v1/consent/history', (req, res) => {
    res.json([
        {
            id: 'consent-old-1',
            hospitalName: 'City Clinic',
            doctorName: 'Dr. James Lee',
            grantedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
            expiresAt: new Date(Date.now() - 86400000 * 10).toISOString(),
            status: 'expired',
            permissions: [{ recordType: 'Prescription', accessLevel: 'read' }]
        }
    ]);
});

app.post('/api/v1/consent/grant', (req, res) => {
    const { hospitalId, hospitalName, durationHours, durationMinutes, permissions } = req.body;
    const newConsent = {
        id: `consent-${Date.now()}`,
        hospitalId,
        hospitalName,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (durationHours * 3600 + (durationMinutes || 0) * 60) * 1000).toISOString(),
        status: 'active',
        permissions
    };
    MOCK_CONSENTS.push(newConsent);
    res.json({ success: true, data: newConsent });
});

app.put('/api/v1/consent/:consentId', (req, res) => {
    res.json({ success: true, message: 'Consent updated' });
});

app.put('/api/v1/consent/revoke/:consentId', (req, res) => {
    const idx = MOCK_CONSENTS.findIndex(c => c.id === req.params.consentId);
    if (idx !== -1) MOCK_CONSENTS[idx].status = 'revoked';
    res.json({ success: true, message: 'Consent revoked' });
});

// ── Medical Records ──
app.get('/api/v1/emr/patients/:patientId/medical-records', (req, res) => {
    res.json({
        success: true,
        data: {
            records: [
                {
                    id: 'rec-1',
                    type: 'consultation',
                    title: 'Annual Physical Examination',
                    description: 'Patient is in good overall health. Blood pressure and heart rate within normal range. Recommended continued exercise and balanced diet.',
                    created_by_name: 'Dr. Sarah Smith',
                    created_by_role: 'DOCTOR',
                    created_at: new Date(Date.now() - 86400000 * 10).toISOString()
                },
                {
                    id: 'rec-2',
                    type: 'lab_result',
                    title: 'Complete Blood Count (CBC)',
                    description: 'All values within normal range. WBC: 6.5, RBC: 4.9, Hemoglobin: 14.2 g/dL. No abnormalities detected.',
                    created_by_name: 'Lab Tech - Medicare Lab',
                    created_by_role: 'LAB_TECH',
                    created_at: new Date(Date.now() - 86400000 * 8).toISOString()
                },
                {
                    id: 'rec-3',
                    type: 'prescription',
                    title: 'Vitamin D3 Supplementation',
                    description: 'Vitamin D3 60,000 IU once weekly for 8 weeks. Recheck levels after course completion.',
                    created_by_name: 'Dr. Sarah Smith',
                    created_by_role: 'DOCTOR',
                    created_at: new Date(Date.now() - 86400000 * 7).toISOString()
                },
                {
                    id: 'rec-4',
                    type: 'diagnosis',
                    title: 'Mild Vitamin D Deficiency',
                    description: 'Serum Vitamin D level at 18 ng/mL. Below optimal range of 30-100 ng/mL. Supplementation prescribed.',
                    created_by_name: 'Dr. Sarah Smith',
                    created_by_role: 'DOCTOR',
                    created_at: new Date(Date.now() - 86400000 * 7).toISOString()
                },
                {
                    id: 'rec-5',
                    type: 'note',
                    title: 'Follow-up Reminder',
                    description: 'Patient advised to return for follow-up in 8 weeks. Check Vitamin D levels and reassess diet.',
                    created_by_name: 'Dr. John Doe',
                    created_by_role: 'DOCTOR',
                    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
                }
            ]
        }
    });
});

// ── Visit Check-In ──
app.post('/api/v1/visits/check-in', (req, res) => {
    const { visitCode } = req.body;
    if (!visitCode) return res.status(400).json({ success: false, message: 'Visit code is required' });
    res.json({
        success: true,
        data: {
            visitId: `visit-checkin-${Date.now()}`,
            visitCode,
            status: 'checked_in',
            hospitalName: 'Medicare General Hospital',
            message: 'Successfully checked in'
        }
    });
});



// ── Audit Trail ──
app.get('/api/v1/audit/my-trail', (req, res) => {
    res.json({
        success: true,
        data: {
            logs: [
                {
                    id: 'log-1',
                    action: 'consent_grant',
                    userFirstName: 'Sarah',
                    userLastName: 'Smith',
                    userEmail: 'dr.sarah@medicare.com',
                    userRole: 'DOCTOR',
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    purpose: 'Pre-surgery consultation access'
                },
                {
                    id: 'log-2',
                    action: 'view_patient_records',
                    userFirstName: 'John',
                    userLastName: 'Doe',
                    userEmail: 'dr.john@medicare.com',
                    userRole: 'DOCTOR',
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    purpose: 'Follow-up appointment review'
                },
                {
                    id: 'log-3',
                    action: 'user_login',
                    userFirstName: 'You',
                    userLastName: '',
                    userEmail: 'patient@medicare.com',
                    userRole: 'PATIENT',
                    timestamp: new Date(Date.now() - 7200000).toISOString(),
                    purpose: null
                },
                {
                    id: 'log-4',
                    action: 'consent_revoke',
                    userFirstName: 'Admin',
                    userLastName: 'User',
                    userEmail: 'admin@medicare.com',
                    userRole: 'ADMIN',
                    timestamp: new Date(Date.now() - 172800000).toISOString(),
                    purpose: 'Access expired per policy'
                }
            ],
            pagination: { total: 4, pages: 1, limit: 50, offset: 0 }
        }
    });
});


// 9. Patient Profile
app.get('/api/v1/patient/profile', (req, res) => {
    // Basic verification without real auth logic for the mock
    res.json({
        success: true,
        data: MOCK_USER
    });
});

// 10. Patient Health Facts (Replaces Stats & Insights)
app.get('/api/v1/patient/health-facts', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                title: "Vital Monitoring",
                description: "Stable heart rate and blood pressure recorded last 24h."
            },
            {
                title: "Calorie Intake",
                description: "Nutritional goals are 85% met for this week's plan."
            },
            {
                title: "Sleep Pattern",
                description: "Average 7.5 hours of deep sleep. Recovery is optimal."
            }
        ]
    });
});

// 11. Patient Activities 
app.get('/api/v1/patient/activities', (req, res) => {
    // Returning dummy activity history, ordered by date descending (most recent first)
    res.json({
        success: true,
        data: [
            {
                id: "act-1",
                type: "Diagnosis",
                title: "Stable Recovery (Post-Op)",
                date: "2025-10-12T10:00:00Z",
                colorClass: "bg-indigo-500",
                borderColorClass: "border-indigo-500/30"
            },
            {
                id: "act-2",
                type: "Medication",
                title: "Amoxicillin 500mg (2x/day)",
                date: "2025-10-11T14:30:00Z",
                colorClass: "bg-indigo-400",
                borderColorClass: "border-indigo-500/30"
            },
            {
                id: "act-3",
                type: "Lab Results",
                title: "WBC - Normal Range",
                date: "2025-09-06T09:15:00Z",
                colorClass: "bg-teal-400",
                borderColorClass: "border-indigo-500/30"
            },
            {
                id: "act-4",
                type: "Hospital Visit",
                title: "Routine Checkup - General Med",
                date: "2025-09-01T11:00:00Z",
                colorClass: "bg-amber-500",
                borderColorClass: "border-indigo-500/30"
            },
            {
                id: "act-5",
                type: "Prescription",
                title: "Vitamin D3 60K IU (Weekly)",
                date: "2025-08-15T16:45:00Z",
                colorClass: "bg-indigo-400",
                borderColorClass: "border-indigo-500/30"
            }
        ]
    });
});

// ── Nurse Endpoints ──
// Nurse Dashboard Stats
app.get('/api/v1/nurse/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            assignedPatients: 14,
            vitalsRecorded: 32,
            careTasks: 8,
            observations: 5
        }
    });
});

// Nurse Assigned Patients
app.get('/api/v1/nurse/assigned-patients', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: "pat-1",
                firstName: "Robert",
                lastName: "Fox",
                room: "101-A",
                condition: "Post-Op Recovery",
                nextCheck: new Date(Date.now() + 1800000).toISOString(), // 30 mins
                status: "stable" // stable, critical, attention
            },
            {
                id: "pat-2",
                firstName: "Emily",
                lastName: "Chen",
                room: "102-B",
                condition: "Observation",
                nextCheck: new Date(Date.now() + 3600000).toISOString(), // 1 hr
                status: "attention"
            },
            {
                id: "pat-3",
                firstName: "Michael",
                lastName: "Ross",
                room: "105-C",
                condition: "Routine Care",
                nextCheck: new Date(Date.now() + 7200000).toISOString(), // 2 hrs
                status: "stable"
            }
        ]
    });
});

// Nurse Activities
app.get('/api/v1/nurse/activities', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: "n-act-1",
                type: "Vitals Recorded",
                title: "Vitals taken for Robert Fox",
                date: new Date(Date.now() - 3600000).toISOString(),
                colorClass: "bg-teal-500",
                borderColorClass: "border-teal-500/30"
            },
            {
                id: "n-act-2",
                type: "Medication Administered",
                title: "Pain meds given to Emily Chen",
                date: new Date(Date.now() - 7200000).toISOString(),
                colorClass: "bg-indigo-500",
                borderColorClass: "border-indigo-500/30"
            },
            {
                id: "n-act-3",
                type: "Assessment",
                title: "Shift assessment for Michael Ross",
                date: new Date(Date.now() - 10800000).toISOString(),
                colorClass: "bg-amber-500",
                borderColorClass: "border-amber-500/30"
            }
        ]
    });
});

// Nurse Patient Records (Fetch)
app.get('/api/v1/nurse/patients/:patientId/records', (req, res) => {
    const { patientId } = req.params;
    res.json({
        success: true,
        data: [
            {
                id: `rec-n1-${patientId}`,
                type: "observation",
                title: "Shift Observation",
                description: "Patient is resting comfortably. No complaints of pain. IV site is clean and intact.",
                created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
                created_by_name: "Nurse Sarah",
                created_by_role: "RN"
            },
            {
                id: `rec-n2-${patientId}`,
                type: "vitals",
                title: "Vitals Check",
                description: "BP: 120/80, HR: 72, Temp: 98.6F, O2: 99%. All within normal limits.",
                created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
                created_by_name: "Nurse Sarah",
                created_by_role: "RN"
            },
            {
                id: `rec-n3-${patientId}`,
                type: "input_action",
                title: "IV Fluid Bag Replaced",
                description: "Replaced 1L Normal Saline bag at 125mL/hr. Patient tolerated well.",
                created_at: new Date(Date.now() - 1800000).toISOString(),
                created_by_name: "Nurse Sarah",
                created_by_role: "RN"
            }
        ]
    });
});

// Nurse Patient Records (Create)
app.post('/api/v1/nurse/patients/:patientId/records', (req, res) => {
    const { patientId } = req.params;
    const { type, title, description } = req.body;
    
    // Simulate creating a record
    const newRecord = {
        id: `rec-n-new-${Date.now()}`,
        type: type || 'observation',
        title: title || 'New Observation',
        description: description || '',
        created_at: new Date().toISOString(),
        created_by_name: "Current Nurse",
        created_by_role: "RN"
    };

    res.json({
        success: true,
        message: "Record created successfully",
        data: newRecord
    });
});

// Nurse Medications (Fetch)
app.get('/api/v1/nurse/medications', (req, res) => {
    // Return a list of medications due for the current shift
    res.json({
        success: true,
        data: [
            {
                id: "med-1",
                patientId: "pat-1",
                patientName: "Robert Fox",
                room: "101-A",
                medicationName: "Amoxicillin",
                dosage: "500mg",
                route: "Oral",
                scheduledTime: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
                status: "pending" // pending, administered, refused
            },
            {
                id: "med-2",
                patientId: "pat-2",
                patientName: "Emily Chen",
                room: "102-B",
                medicationName: "Morphine",
                dosage: "4mg",
                route: "IV",
                scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hr from now
                status: "pending"
            },
            {
                id: "med-3",
                patientId: "pat-3",
                patientName: "Michael Ross",
                room: "105-C",
                medicationName: "Lisinopril",
                dosage: "10mg",
                route: "Oral",
                scheduledTime: new Date(Date.now() - 7200000).toISOString(), // 2 hrs ago
                status: "administered",
                administeredAt: new Date(Date.now() - 7000000).toISOString()
            }
        ]
    });
});

// Nurse Medications (Update Status)
app.put('/api/v1/nurse/medications/:medicationId/status', (req, res) => {
    const { medicationId } = req.params;
    const { status, notes } = req.body;
    
    // Simulate updating the medication record
    res.json({
        success: true,
        message: `Medication ${medicationId} marked as ${status}`,
        data: {
            id: medicationId,
            status: status,
            notes: notes || '',
            updatedAt: new Date().toISOString()
        }
    });
});

// Nurse Profile (Fetch)
app.get('/api/v1/nurse/profile', (req, res) => {
    res.json({
        success: true,
        data: {
            id: "nurse-789",
            firstName: "Sarah",
            lastName: "Jenkins",
            role: "Registered Nurse",
            employeeId: "RN-2024-56789",
            department: "General Medicine",
            email: "sarah.jenkins@medicare.com",
            phone: "+1 (555) 123-4567",
            status: "Active",
            joinedDate: "2020-03-15",
            licenseNumber: "RN987654321",
            address: "123 Healthcare Ave, Medical District, NY 10001",
            emergencyContact: {
                name: "Michael Jenkins",
                relationship: "Spouse",
                phone: "+1 (555) 987-6543"
            },
            assignedWards: ["Ward A (East Wing)", "Ward B (West Wing)"],
            shiftPreference: "Day Shift (07:00 - 19:00)"
        }
    });
});

// Nurse Profile (Update)
app.put('/api/v1/nurse/profile', (req, res) => {
    // In a real backend, we'd validate and save the body
    const incomingData = req.body;
    
    // Simulate updating
    res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
            // merge mock structure with incoming changes for a realistic response
            id: "nurse-789",
            firstName: "Sarah",
            lastName: "Jenkins",
            role: "Registered Nurse",
            employeeId: "RN-2024-56789",
            department: "General Medicine",
            email: "sarah.jenkins@medicare.com",
            status: "Active",
            joinedDate: "2020-03-15",
            licenseNumber: "RN987654321",
            assignedWards: ["Ward A (East Wing)", "Ward B (West Wing)"],
            shiftPreference: "Day Shift (07:00 - 19:00)",
            phone: incomingData.phone || "+1 (555) 123-4567",
            address: incomingData.address || "123 Healthcare Ave, Medical District, NY 10001",
            emergencyContact: incomingData.emergencyContact || {
                name: "Michael Jenkins",
                relationship: "Spouse",
                phone: "+1 (555) 987-6543"
            }
        }
    });
});

// ==========================================
// RADIOLOGY PORTAL API ENDPOINTS
// ==========================================

// Radiology Dashboard Stats
app.get('/api/v1/radiology/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            pendingReads: 14,
            inProgress: 3,
            completedToday: 28,
            priorityCases: 2
        }
    });
});

// Radiology Imaging Orders (Queue)
app.get('/api/v1/radiology/orders', (req, res) => {
    const statusFilter = req.query.status;
    const priorityFilter = req.query.priority;

    let orders = [
        {
            id: 'img-req-001', visitId: 'VST-2024-0891', patientName: 'Anjali Mehta', patientInitial: 'A',
            imagingType: 'MRI', bodyPart: 'Brain', priority: 'stat', status: 'pending',
            orderedBy: 'Dr. Sharma', orderedAt: new Date(Date.now() - 1800000).toISOString(),
            clinicalNotes: 'Sudden onset severe headache, rule out hemorrhage.'
        },
        {
            id: 'img-req-002', visitId: 'VST-2024-0892', patientName: 'Ravi Patel', patientInitial: 'R',
            imagingType: 'CT Scan', bodyPart: 'Chest', priority: 'urgent', status: 'in_progress',
            orderedBy: 'Dr. Kapoor', orderedAt: new Date(Date.now() - 3600000).toISOString(),
            clinicalNotes: 'Persistent cough, shortness of breath.'
        },
        {
            id: 'img-req-003', visitId: 'VST-2024-0893', patientName: 'Priya Singh', patientInitial: 'P',
            imagingType: 'X-Ray', bodyPart: 'Left Ankle', priority: 'routine', status: 'pending',
            orderedBy: 'Dr. Verma', orderedAt: new Date(Date.now() - 7200000).toISOString(),
            clinicalNotes: 'Twisted ankle during sports, swelling present.'
        },
        {
            id: 'img-req-004', visitId: 'VST-2024-0894', patientName: 'Suresh Kumar', patientInitial: 'S',
            imagingType: 'Ultrasound', bodyPart: 'Abdomen', priority: 'routine', status: 'completed',
            orderedBy: 'Dr. Gupta', orderedAt: new Date(Date.now() - 86400000).toISOString(),
            clinicalNotes: 'Routine check for kidney stones.'
        },
        {
            id: 'img-req-005', visitId: 'VST-2024-0895', patientName: 'Meera Reddy', patientInitial: 'M',
            imagingType: 'MRI', bodyPart: 'Lumbar Spine', priority: 'stat', status: 'pending',
            orderedBy: 'Dr. Nair', orderedAt: new Date(Date.now() - 900000).toISOString(),
            clinicalNotes: 'Severe lower back pain radiating to legs, numbing sensation.'
        }
    ];

    if (statusFilter && statusFilter !== 'all') {
        orders = orders.filter(o => o.status === statusFilter);
    }
    
    if (priorityFilter === 'stat') {
        orders = orders.filter(o => o.priority === 'stat');
    }

    res.json({
        success: true,
        count: orders.length,
        data: orders
    });
});

// Radiology Report Upload (Simulation)
app.post('/api/v1/radiology/upload', (req, res) => {
    // We are simulating a multipart/form-data upload.
    // Realistically, multer would parse req.file and req.body.
    // In this mock, we just accept the request and return success.
    res.json({
        success: true,
        message: 'Imaging report securely uploaded and cryptographically signed.',
        reportId: 'rep-' + Date.now()
    });
});

// Radiology Profile (GET)
app.get('/api/v1/radiology/profile', (req, res) => {
    res.json({
        success: true,
        data: {
            id: "rad-101",
            firstName: "Rajesh",
            lastName: "Khanna",
            role: "Senior Radiologist",
            employeeId: "RAD-2024-88990",
            department: "Imaging & Diagnostics",
            email: "radiologist@medicare.com",
            phone: "+1 (555) 321-7654",
            status: "Active",
            joinedDate: "2018-06-12",
            licenseNumber: "MD-RAD-112233",
            subSpecialty: "Neuro & MSK Radiology",
            modalities: ["MRI", "CT Scan", "X-Ray"],
            shiftPreference: "Day Shift (08:00 - 18:00)",
            address: "456 Diagnostics Blvd, Medical City, NY 10002",
            emergencyContact: {
                name: "Priya Khanna",
                relationship: "Spouse",
                phone: "+1 (555) 876-5432"
            }
        }
    });
});

// Radiology Profile (PUT)
app.put('/api/v1/radiology/profile', (req, res) => {
    const incomingData = req.body;
    res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
            id: "rad-101",
            firstName: "Rajesh",
            lastName: "Khanna",
            role: "Senior Radiologist",
            employeeId: "RAD-2024-88990",
            department: "Imaging & Diagnostics",
            email: "radiologist@medicare.com",
            status: "Active",
            joinedDate: "2018-06-12",
            licenseNumber: "MD-RAD-112233",
            subSpecialty: "Neuro & MSK Radiology",
            modalities: ["MRI", "CT Scan", "X-Ray"],
            shiftPreference: "Day Shift (08:00 - 18:00)",
            phone: incomingData.phone || "+1 (555) 321-7654",
            address: incomingData.address || "456 Diagnostics Blvd, Medical City, NY 10002",
            emergencyContact: incomingData.emergencyContact || {
                name: "Priya Khanna",
                relationship: "Spouse",
                phone: "+1 (555) 876-5432"
            }
        }
    });
});

// Radiology Audit Logs
app.get('/api/v1/radiology/audit-logs', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: "AL-1004", timestamp: new Date().toISOString(), action: "REPORT_SIGNED", ip: "192.168.1.55", details: "Signed MRI report for Order ORD-4829" },
            { id: "AL-1003", timestamp: new Date(Date.now() - 3600000).toISOString(), action: "LOGIN_SUCCESS", ip: "192.168.1.55", details: "Secure authentication" },
            { id: "AL-1002", timestamp: new Date(Date.now() - 86400000).toISOString(), action: "IMAGE_VIEWED", ip: "192.168.1.55", details: "Viewed CT Scan images for Order ORD-3991" },
            { id: "AL-1001", timestamp: new Date(Date.now() - 90000000).toISOString(), action: "PROFILE_UPDATED", ip: "192.168.1.55", details: "Updated emergency contact info" },
            { id: "AL-1000", timestamp: new Date(Date.now() - 172800000).toISOString(), action: "REPORT_UPLOADED", ip: "192.168.1.55", details: "Uploaded X-Ray report for Order ORD-3882" }
        ]
    });
});

// ==========================================
// PHARMACIST PORTAL API ENDPOINTS
// ==========================================

// Pharmacist Dashboard Stats
app.get('/api/v1/pharmacist/stats', (req, res) => {
    res.json({
        success: true,
        data: {
            pendingPrescriptions: 12,
            dispensedToday: 48,
            lowStockAlerts: 3,
            refillRequests: 5
        }
    });
});

let mockPrescriptions = [
    {
        id: 'rx-2024-001',
        patientName: 'Robert Fox',
        patientId: 'PAT-8819',
        medication: 'Amoxicillin 500mg',
        dosage: '1 capsule three times daily for 7 days',
        prescribedBy: 'Dr. Sarah Smith',
        prescribedAt: new Date(Date.now() - 3600000).toISOString(),
        status: 'pending' // 'pending', 'dispensed'
    },
    {
        id: 'rx-2024-002',
        patientName: 'Emily Chen',
        patientId: 'PAT-8820',
        medication: 'Lisinopril 10mg',
        dosage: '1 tablet daily',
        prescribedBy: 'Dr. James Lee',
        prescribedAt: new Date(Date.now() - 7200000).toISOString(),
        status: 'pending'
    },
    {
        id: 'rx-2024-003',
        patientName: 'Michael Ross',
        patientId: 'PAT-8821',
        medication: 'Metformin 500mg',
        dosage: '1 tablet twice daily with meals',
        prescribedBy: 'Dr. Sarah Smith',
        prescribedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'dispensed'
    }
];

// Pharmacist Prescriptions Queue
app.get('/api/v1/pharmacist/prescriptions', (req, res) => {
    const statusFilter = req.query.status;
    let results = mockPrescriptions;
    
    if (statusFilter && statusFilter !== 'all') {
        results = results.filter(p => p.status === statusFilter);
    }
    
    res.json({
        success: true,
        data: results
    });
});

// Pharmacist Dispense Prescription
app.put('/api/v1/pharmacist/prescriptions/:id/dispense', (req, res) => {
    const { id } = req.params;
    const rx = mockPrescriptions.find(p => p.id === id);
    if (rx) {
        rx.status = 'dispensed';
        res.json({ success: true, message: `Prescription ${id} marked as dispensed.` });
    } else {
        res.status(404).json({ success: false, message: 'Prescription not found.' });
    }
});

// Pharmacist Inventory
app.get('/api/v1/pharmacist/inventory', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'inv-101', name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotic', stock: 450, status: 'In Stock', location: 'Aisle 2, Shelf B' },
            { id: 'inv-102', name: 'Lisinopril 10mg', genericName: 'Lisinopril', category: 'Cardiovascular', stock: 12, status: 'Low Stock', location: 'Aisle 3, Shelf A' },
            { id: 'inv-103', name: 'Metformin 500mg', genericName: 'Metformin', category: 'Antidiabetic', stock: 850, status: 'In Stock', location: 'Aisle 1, Shelf C' },
            { id: 'inv-104', name: 'Atorvastatin 20mg', genericName: 'Atorvastatin', category: 'Cardiovascular', stock: 0, status: 'Out of Stock', location: 'Aisle 3, Shelf B' },
            { id: 'inv-105', name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Analgesic', stock: 1200, status: 'In Stock', location: 'Aisle 4, Shelf A' }
        ]
    });
});

// Pharmacist Profile (GET)
app.get('/api/v1/pharmacist/profile', (req, res) => {
    res.json({
        success: true,
        data: {
            id: "pharm-456",
            firstName: "Aisha",
            lastName: "Patel",
            role: "Lead Pharmacist",
            employeeId: "PHM-2023-55667",
            department: "Pharmacy",
            email: "pharmacist@medicare.com",
            phone: "+1 (555) 777-8899",
            status: "Active",
            joinedDate: "2020-03-15",
            licenseNumber: "PH-99887766",
            shiftPreference: "Morning Shift (06:00 - 14:00)",
            address: "789 Healthway Drive, Medical City, NY 10003"
        }
    });
});

// Pharmacist Profile (PUT)
app.put('/api/v1/pharmacist/profile', (req, res) => {
    const incomingData = req.body;
    res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
            id: "pharm-456",
            firstName: "Aisha",
            lastName: "Patel",
            role: "Lead Pharmacist",
            employeeId: "PHM-2023-55667",
            department: "Pharmacy",
            email: "pharmacist@medicare.com",
            status: "Active",
            joinedDate: "2020-03-15",
            licenseNumber: "PH-99887766",
            shiftPreference: "Morning Shift (06:00 - 14:00)",
            phone: incomingData.phone || "+1 (555) 777-8899",
            address: incomingData.address || "789 Healthway Drive, Medical City, NY 10003"
        }
    });
});

// Pharmacist Audit Logs
app.get('/api/v1/pharmacist/audit-logs', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: "PAL-2005", timestamp: new Date().toISOString(), action: "RX_DISPENSED", ip: "192.168.1.60", details: "Dispensed Amoxicillin 500mg for Patient PAT-8819" },
            { id: "PAL-2004", timestamp: new Date(Date.now() - 3600000).toISOString(), action: "LOGIN_SUCCESS", ip: "192.168.1.60", details: "Secure authentication" },
            { id: "PAL-2003", timestamp: new Date(Date.now() - 86400000).toISOString(), action: "INVENTORY_UPDATED", ip: "192.168.1.60", details: "Received stock for Ibuprofen 400mg" },
            { id: "PAL-2002", timestamp: new Date(Date.now() - 90000000).toISOString(), action: "PROFILE_UPDATED", ip: "192.168.1.60", details: "Updated contact phone number" },
            { id: "PAL-2001", timestamp: new Date(Date.now() - 172800000).toISOString(), action: "RX_DISPENSED", ip: "192.168.1.60", details: "Dispensed Metformin 500mg for Patient PAT-8821" }
        ]
    });
});

// ==========================================
// COMPLIANCE OFFICER PORTAL API ENDPOINTS
// ==========================================

// Display High Level Stats
app.get('/api/v1/compliance/dashboard', (req, res) => {
    res.json({
        success: true,
        data: {
            authAnomalies: 3,
            openIncidents: 5,
            activeOverrides: 2,
            pendingReviews: 12
        }
    });
});

// Mock Data for Incidents
let mockIncidents = [
    { id: "INC-2024-001", date: new Date(Date.now() - 86400000).toISOString(), type: "Unauthorized Access", reporter: "Automated System", status: "Investigating", description: "Multiple failed login attempts detected from IP 192.168.1.45." },
    { id: "INC-2024-002", date: new Date(Date.now() - 172800000).toISOString(), type: "Data Breach Suspected", reporter: "Sarah Jenkins", status: "Open", description: "Nurse reported finding printed patient records left unattended at Station C." },
    { id: "INC-2024-003", date: new Date(Date.now() - 432000000).toISOString(), type: "Policy Violation", reporter: "Dr. Smith", status: "Resolved", description: "Staff member used unsecured personal device to view schedules." }
];

app.get('/api/v1/compliance/incidents', (req, res) => {
    res.json({
        success: true,
        data: mockIncidents
    });
});

app.put('/api/v1/compliance/incidents/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const incident = mockIncidents.find(inc => inc.id === id);
    if (incident) {
        incident.status = status;
        res.json({ success: true, message: `Incident ${id} updated to ${status}.` });
    } else {
        res.status(404).json({ success: false, message: 'Incident not found.' });
    }
});

app.get('/api/v1/compliance/global-audits', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: "AUD-9905", timestamp: new Date().toISOString(), user: "Sarah Jenkins (NURSE)", action: "VIEW_RECORD", details: "Accessed vitals history for PAT-8819", status: "Success" },
            { id: "AUD-9904", timestamp: new Date(Date.now() - 60000).toISOString(), user: "Unknown (NULL)", action: "LOGIN_FAILED", details: "Invalid password attempt for admin", status: "Failed" },
            { id: "AUD-9903", timestamp: new Date(Date.now() - 3600000).toISOString(), user: "Dr. Smith (DOCTOR)", action: "OVERRIDE_CONSENT", details: "Emergency access to PAT-9002 (Consent Denied flag ignored)", status: "Warning" },
            { id: "AUD-9902", timestamp: new Date(Date.now() - 86400000).toISOString(), user: "Aisha Patel (PHARMACIST)", action: "RX_DISPENSED", details: "Dispensed Rx rx-2024-001", status: "Success" },
            { id: "AUD-9901", timestamp: new Date(Date.now() - 90000000).toISOString(), user: "Admin (ADMIN)", action: "USER_INVITED", details: "Invited new staff member (radiologist)", status: "Success" }
        ]
    });
});

app.get('/api/v1/compliance/consent-overrides', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: "OVR-501", date: new Date(Date.now() - 3600000).toISOString(), doctor: "Dr. Sarah Smith", patientId: "PAT-9002", reason: "Medical Emergency (Cardiac Arrest)", status: "Pending Review" },
            { id: "OVR-502", date: new Date(Date.now() - 86400000).toISOString(), doctor: "Dr. James Lee", patientId: "PAT-1120", reason: "Patient unresponsive in ER", status: "Approved" }
        ]
    });
});

app.get('/api/v1/compliance/profile', (req, res) => {
    res.json({
        success: true,
        data: {
            id: "comp-999",
            firstName: "Robert",
            lastName: "Oppenheimer",
            role: "Chief Compliance Officer",
            employeeId: "CCO-2015-001",
            department: "Legal & Security",
            email: "compliance@medicare.com",
            phone: "+1 (555) 999-0000",
            status: "Active",
            joinedDate: "2015-08-01",
            address: "100 Security Blvd, MedTech Park, CA"
        }
    });
});

app.put('/api/v1/compliance/profile', (req, res) => {
    const incomingData = req.body;
    res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
            id: "comp-999",
            firstName: "Robert",
            lastName: "Oppenheimer",
            role: "Chief Compliance Officer",
            employeeId: "CCO-2015-001",
            department: "Legal & Security",
            email: "compliance@medicare.com",
            status: "Active",
            joinedDate: "2015-08-01",
            phone: incomingData.phone || "+1 (555) 999-0000",
            address: incomingData.address || "100 Security Blvd, MedTech Park, CA"
        }
    });
});


// ==========================================
// INSURANCE MODULE
// ==========================================

let insuranceClaims = [
    { id: 'CLM-001', patientName: 'John Doe', policyNumber: 'POL-123456', diagnosis: 'Hypertension', amount: 150.00, status: 'Pending', submittedAt: '2026-03-01T10:00:00Z' },
    { id: 'CLM-002', patientName: 'Jane Smith', policyNumber: 'POL-654321', diagnosis: 'Type 2 Diabetes', amount: 350.50, status: 'Approved', submittedAt: '2026-03-02T14:30:00Z' },
    { id: 'CLM-003', patientName: 'Robert Johnson', policyNumber: 'POL-987654', diagnosis: 'Asthma', amount: 80.00, status: 'Denied', submittedAt: '2026-03-03T09:15:00Z', notes: 'Service not covered under basic plan' },
    { id: 'CLM-004', patientName: 'Emily Davis', policyNumber: 'POL-456789', diagnosis: 'Migraine', amount: 420.00, status: 'Pending', submittedAt: '2026-03-05T11:45:00Z' }
];

let policyholders = [
    { id: 'PH-001', name: 'John Doe', policyNumber: 'POL-123456', type: 'Premium', status: 'Active', coverageStart: '2025-01-01', coverageEnd: '2026-12-31' },
    { id: 'PH-002', name: 'Jane Smith', policyNumber: 'POL-654321', type: 'Basic', status: 'Active', coverageStart: '2025-06-01', coverageEnd: '2026-05-31' },
    { id: 'PH-003', name: 'Michael Brown', policyNumber: 'POL-111222', type: 'Family', status: 'Expired', coverageStart: '2024-01-01', coverageEnd: '2024-12-31' },
    { id: 'PH-004', name: 'Emily Davis', policyNumber: 'POL-456789', type: 'Premium', status: 'Active', coverageStart: '2025-03-01', coverageEnd: '2027-02-28' }
];

let insuranceProfile = {
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'agent@bluecross.com',
    phone: '+1 (555) 987-6543',
    department: 'Claims Processing',
    company: 'BlueCross Health',
    agentId: 'AGT-2024-5678',
    role: 'Senior Claims Agent'
};

const verifyToken = (req, res, next) => {
    // Mock token verification
    next();
};

app.get('/api/v1/insurance/dashboard', verifyToken, (req, res) => {
    const pending = insuranceClaims.filter(c => c.status === 'Pending').length;
    const approved = insuranceClaims.filter(c => c.status === 'Approved').length;
    const denied = insuranceClaims.filter(c => c.status === 'Denied').length;
    const totalPayout = insuranceClaims.filter(c => c.status === 'Approved').reduce((sum, c) => sum + c.amount, 0);
    const activePolicies = policyholders.filter(p => p.status === 'Active').length;

    res.json({
        success: true,
        data: {
            pendingClaims: pending,
            approvedClaims: approved,
            deniedClaims: denied,
            totalPayout: totalPayout.toFixed(2),
            activePolicies,
            recentClaims: insuranceClaims.slice(0, 3)
        }
    });
});

app.get('/api/v1/insurance/claims', verifyToken, (req, res) => {
    res.json({
        success: true,
        data: insuranceClaims
    });
});

app.put('/api/v1/insurance/claims/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const claimIndex = insuranceClaims.findIndex(c => c.id === id);
    if (claimIndex !== -1) {
        insuranceClaims[claimIndex] = { ...insuranceClaims[claimIndex], status, notes: notes || insuranceClaims[claimIndex].notes };
        res.json({ success: true, data: insuranceClaims[claimIndex] });
    } else {
        res.status(404).json({ success: false, message: 'Claim not found' });
    }
});

app.get('/api/v1/insurance/coverage/verify', verifyToken, (req, res) => {
    const { memberId, policyNumber } = req.query;
    const holder = policyholders.find(p => p.id === memberId || p.policyNumber === policyNumber);
    if (holder) {
        res.json({
            success: true,
            data: {
                covered: holder.status === 'Active',
                policyDetails: holder,
                copay: 25.00,
                deductibleUsed: 1500.00,
                deductibleTotal: 5000.00
            }
        });
    } else {
        res.json({
            success: true,
            data: { covered: false, policyDetails: null, message: "Policy not found or inactive" }
        });
    }
});

app.get('/api/v1/insurance/policyholders', verifyToken, (req, res) => {
    res.json({ success: true, data: policyholders });
});

app.get('/api/v1/insurance/profile', verifyToken, (req, res) => {
    res.json({ success: true, data: insuranceProfile });
});

app.put('/api/v1/insurance/profile', verifyToken, (req, res) => {
    insuranceProfile = { ...insuranceProfile, ...req.body };
    res.json({ success: true, data: insuranceProfile });
});


// ── Researcher Portal ──

app.get('/api/v1/research/stats', verifyToken, (req, res) => {
    res.json({
        success: true,
        data: {
            totalRecords: 125430,
            activeStudies: 12,
            anonymizedPatients: 45200,
            dataPointsCollected: 850024
        }
    });
});

app.get('/api/v1/research/symptoms', verifyToken, (req, res) => {
    res.json({
        success: true,
        data: [
            { name: "Fatigue", count: 1250, severityAvg: 4.2 },
            { name: "Fever", count: 890, severityAvg: 6.1 },
            { name: "Headache", count: 2100, severityAvg: 3.8 },
            { name: "Nausea", count: 650, severityAvg: 5.5 },
            { name: "Shortness of Breath", count: 420, severityAvg: 7.2 }
        ]
    });
});

app.get('/api/v1/research/treatments', verifyToken, (req, res) => {
    res.json({
        success: true,
        data: [
            { name: "Amoxicillin", successRate: 85, usageCount: 5400 },
            { name: "Lisinopril", successRate: 72, usageCount: 8900 },
            { name: "Metformin", successRate: 68, usageCount: 12000 },
            { name: "Ibuprofen", successRate: 92, usageCount: 25000 },
            { name: "Physical Therapy", successRate: 65, usageCount: 3200 }
        ]
    });
});

app.get('/api/v1/research/demographics', verifyToken, (req, res) => {
    res.json({
        success: true,
        data: {
            ageGroups: [
                { range: "0-18", percentage: 15 },
                { range: "19-35", percentage: 25 },
                { range: "36-50", percentage: 30 },
                { range: "51-65", percentage: 20 },
                { range: "65+", percentage: 10 }
            ],
            gender: [
                { category: "Male", percentage: 48 },
                { category: "Female", percentage: 51 },
                { category: "Other", percentage: 1 }
            ]
        }
    });
});

app.get('/api/v1/research/profile', verifyToken, (req, res) => {
    res.json({
        success: true,
        data: {
            id: "res-303",
            firstName: "Emily",
            lastName: "Stanton",
            role: "Lead Data Scientist",
            email: "researcher@medicare.com",
            phone: "+1 (555) 303-4040",
            department: "Clinical Research & Informatics",
            institution: "Medicare Global Research Setup",
            status: "Active"
        }
    });
});

app.put('/api/v1/research/profile', verifyToken, (req, res) => {
    const { phone, department } = req.body;
    res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
            id: "res-303",
            email: "researcher@medicare.com",
            phone: phone || "+1 (555) 303-4040",
            department: department || "Clinical Research & Informatics"
        }
    });
});


// --- Catch all for unhandled routes ---
app.use((req, res) => {
    console.log(`[MOCK] Unhandled route accessed: ${req.method} ${req.url}`);
    res.status(404).json({ success: false, message: 'Mock endpoint not found' });
});

// Start mock server
app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 MOCK Backend running on http://localhost:${PORT}`);
    console.log(`===============================================`);
    console.log(`Mocking endpoints for Frontend Port 3000`);
});
