const { query } = require('../../config/db');
const logger = require('../../utils/logger');

const PatientController = {
    /**
     * GET /api/v1/patient/profile
     * Returns basic profile info for the logged-in patient.
     */
    async getProfile(req, res) {
        try {
            const patientId = req.user.id;

            const result = await query(
                `SELECT id, first_name AS "firstName", last_name AS "lastName",
                        email, phone, status, created_at AS "createdAt"
                 FROM users
                 WHERE id = $1`,
                [patientId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Patient not found' });
            }

            return res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            logger.error('Get patient profile failed:', error);
            return res.status(500).json({ success: false, message: 'Failed to retrieve patient profile' });
        }
    },

    /**
     * GET /api/v1/patient/health-facts
     * Returns dynamic health facts derived from recent records, or wellness tips if none.
     */
    async getHealthFacts(req, res) {
        try {
            const patientId = req.user.id;

            // Pull the 5 most recent medical records for this patient
            const recordsRes = await query(
                `SELECT mr.type, mr.title, mr.created_at
                 FROM medical_records mr
                 WHERE mr.patient_id = $1
                 ORDER BY mr.created_at DESC
                 LIMIT 5`,
                [patientId]
            );

            let facts = [];

            if (recordsRes.rows.length > 0) {
                const typeToFact = {
                    consultation: {
                        title: 'Recent Consultation',
                        description: 'You had a recent medical consultation. Follow up with your doctor if symptoms persist.'
                    },
                    diagnosis: {
                        title: 'Active Diagnosis on File',
                        description: 'You have an active diagnosis recorded. Ensure you are following your treatment plan.'
                    },
                    prescription: {
                        title: 'Prescription Reminder',
                        description: 'You have an active prescription. Take your medication as directed by your physician.'
                    },
                    lab_result: {
                        title: 'Lab Results Available',
                        description: 'Your lab results have been recorded. Review them with your doctor for personalized guidance.'
                    },
                    imaging: {
                        title: 'Imaging Report Filed',
                        description: 'An imaging report is on file. Speak to your doctor to understand your imaging results.'
                    },
                    procedure: {
                        title: 'Procedure Documented',
                        description: 'A procedure has been documented. Adhere to post-procedure care instructions carefully.'
                    },
                    note: {
                        title: 'Clinical Note Added',
                        description: 'Your care team has added a clinical note. Stay in touch with your doctor for any updates.'
                    }
                };

                const seenTypes = new Set();
                for (const row of recordsRes.rows) {
                    const type = row.type?.toLowerCase();
                    if (!seenTypes.has(type) && typeToFact[type]) {
                        facts.push(typeToFact[type]);
                        seenTypes.add(type);
                    }
                    if (facts.length >= 3) break;
                }
            }

            // Fill remaining slots with generic wellness tips
            const genericTips = [
                {
                    title: 'Vital Monitoring',
                    description: 'Keep track of your heart rate and blood pressure. Regular monitoring helps detect changes early.'
                },
                {
                    title: 'Nutrition & Hydration',
                    description: 'Drink at least 8 glasses of water daily and maintain a balanced diet rich in vegetables and whole grains.'
                },
                {
                    title: 'Sleep Health',
                    description: 'Aim for 7–9 hours of quality sleep per night. Good sleep is essential for immune function and recovery.'
                }
            ];

            let tipIndex = 0;
            while (facts.length < 3 && tipIndex < genericTips.length) {
                facts.push(genericTips[tipIndex]);
                tipIndex++;
            }

            return res.json({ success: true, data: facts });
        } catch (error) {
            logger.error('Get health facts failed:', error);
            return res.status(500).json({ success: false, message: 'Failed to retrieve health facts' });
        }
    },

    /**
     * GET /api/v1/patient/activities
     * Returns a unified, date-sorted activity feed from visits, diagnoses, and medical records.
     */
    async getActivities(req, res) {
        try {
            const patientId = req.user.id;

            const activitiesQuery = `
                SELECT
                    id,
                    type,
                    title,
                    activity_date AS date,
                    color_class AS "colorClass",
                    border_color_class AS "borderColorClass"
                FROM (
                    -- Visits
                    SELECT
                        v.id::text,
                        'Visit' AS type,
                        COALESCE(v.reason, 'Hospital Visit') AS title,
                        v.created_at AS activity_date,
                        'bg-amber-500' AS color_class,
                        'border-amber-500/30' AS border_color_class
                    FROM visits v
                    WHERE v.patient_id = $1

                    UNION ALL

                    -- Medical Records
                    SELECT
                        mr.id::text,
                        CASE mr.type
                            WHEN 'consultation' THEN 'Consultation'
                            WHEN 'diagnosis'    THEN 'Diagnosis'
                            WHEN 'prescription' THEN 'Prescription'
                            WHEN 'lab_result'   THEN 'Lab Result'
                            WHEN 'imaging'      THEN 'Imaging'
                            WHEN 'procedure'    THEN 'Procedure'
                            ELSE 'Medical Record'
                        END AS type,
                        COALESCE(mr.title, 'Medical Record') AS title,
                        mr.created_at AS activity_date,
                        CASE mr.type
                            WHEN 'consultation' THEN 'bg-indigo-500'
                            WHEN 'diagnosis'    THEN 'bg-rose-500'
                            WHEN 'prescription' THEN 'bg-teal-500'
                            WHEN 'lab_result'   THEN 'bg-blue-500'
                            WHEN 'imaging'      THEN 'bg-purple-500'
                            WHEN 'procedure'    THEN 'bg-orange-500'
                            ELSE 'bg-slate-500'
                        END AS color_class,
                        CASE mr.type
                            WHEN 'consultation' THEN 'border-indigo-500/30'
                            WHEN 'diagnosis'    THEN 'border-rose-500/30'
                            WHEN 'prescription' THEN 'border-teal-500/30'
                            WHEN 'lab_result'   THEN 'border-blue-500/30'
                            WHEN 'imaging'      THEN 'border-purple-500/30'
                            WHEN 'procedure'    THEN 'border-orange-500/30'
                            ELSE 'border-slate-500/30'
                        END AS border_color_class
                    FROM medical_records mr
                    WHERE mr.patient_id = $1

                ) AS combined
                ORDER BY activity_date DESC
                LIMIT 20
            `;

            const result = await query(activitiesQuery, [patientId]);

            return res.json({ success: true, data: result.rows });
        } catch (error) {
            logger.error('Get patient activities failed:', error);
            return res.status(500).json({ success: false, message: 'Failed to retrieve activities' });
        }
    }
};

module.exports = PatientController;
