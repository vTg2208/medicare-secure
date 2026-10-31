const { query } = require('../config/db');
const logger = require('../utils/logger');
const { ROLES, ACCESS_ACTIONS } = require('../utils/constants');
const { checkConsent } = require('../models/consent.model');
const { isOnShift } = require('./shift.service');

/**
 * Policy Enforcement Service
 * Implements Attribute-Based Access Control (ABAC) for healthcare data
 */

/**
 * Policy decision structure
 * @typedef {Object} PolicyDecision
 * @property {Boolean} allowed - Whether access is allowed
 * @property {String} reason - Reason for the decision
 * @property {Array} conditions - Additional conditions that must be met
 */

/**
 * Evaluate access policy based on multiple attributes
 * @param {Object} context - Access context
 * @param {String} context.userId - User requesting access
 * @param {String} context.userRole - Role of the user
 * @param {String} context.patientId - Patient whose data is being accessed
 * @param {String} context.resource - Resource being accessed
 * @param {String} context.action - Action being performed (read, write, delete)
 * @param {String} context.dataCategory - Category of data
 * @param {Object} context.metadata - Additional metadata
 * @returns {Promise<PolicyDecision>} Policy decision
 */
const evaluatePolicy = async (context) => {
    try {
        const {
            userId,
            userRole,
            patientId,
            resource,
            action,
            dataCategory,
            metadata = {},
        } = context;

        logger.info(`Evaluating policy for user ${userId} (${userRole}) accessing ${resource}`);

        // Rule 1: Patients can always access their own data
        if (userRole === ROLES.PATIENT && userId === patientId) {
            return {
                allowed: true,
                reason: 'Patient accessing own data',
                conditions: [],
            };
        }

        // Rule 2: System admins have full access (with audit logging)
        if (userRole === ROLES.SYSTEM_ADMIN) {
            return {
                allowed: true,
                reason: 'System administrator access',
                conditions: ['audit_required'],
            };
        }

        // Rule 3: Compliance officers have read-only access to all data
        if (userRole === ROLES.COMPLIANCE_OFFICER) {
            if (action === ACCESS_ACTIONS.READ) {
                return {
                    allowed: true,
                    reason: 'Compliance officer read access',
                    conditions: ['audit_required'],
                };
            } else {
                return {
                    allowed: false,
                    reason: 'Compliance officers have read-only access',
                    conditions: [],
                };
            }
        }

        // Rule 4: Healthcare providers need consent
        const healthcareRoles = [
            ROLES.DOCTOR,
            ROLES.NURSE,
            ROLES.LAB_TECHNICIAN,
            ROLES.RADIOLOGIST,
            ROLES.PHARMACIST,
        ];

        if (healthcareRoles.includes(userRole)) {
            // Check shift status
            const onShift = await isOnShift(userId);

            if (!onShift && !metadata.emergencyOverride) {
                return {
                    allowed: false,
                    reason: 'Staff member not on shift',
                    conditions: ['emergency_override_required'],
                };
            }

            // Check consent
            const hasConsent = await checkConsent(
                patientId,
                userId,
                dataCategory,
                action === ACCESS_ACTIONS.WRITE ? 'write' : 'read'
            );

            if (hasConsent) {
                return {
                    allowed: true,
                    reason: 'Valid consent found',
                    conditions: ['audit_required'],
                };
            }

            // No consent - check for emergency access
            if (metadata.emergencyOverride && metadata.emergencyJustification) {
                return {
                    allowed: true,
                    reason: 'Emergency access granted',
                    conditions: ['audit_required', 'notify_patient', 'compliance_review'],
                };
            }

            return {
                allowed: false,
                reason: 'No active consent found',
                conditions: ['consent_required'],
            };
        }

        // Rule 5: Researchers only get anonymized data
        if (userRole === ROLES.RESEARCHER) {
            if (dataCategory === 'anonymized' || metadata.anonymized === true) {
                return {
                    allowed: true,
                    reason: 'Researcher accessing anonymized data',
                    conditions: ['audit_required'],
                };
            } else {
                return {
                    allowed: false,
                    reason: 'Researchers can only access anonymized data',
                    conditions: ['anonymization_required'],
                };
            }
        }

        // Rule 6: Insurance providers - limited access
        if (userRole === ROLES.INSURANCE_PROVIDER) {
            const allowedCategories = ['billing', 'insurance_claim', 'diagnoses'];

            if (allowedCategories.includes(dataCategory)) {
                // Still need consent
                const hasConsent = await checkConsent(patientId, userId, dataCategory, 'read');

                if (hasConsent) {
                    return {
                        allowed: true,
                        reason: 'Insurance provider with valid consent',
                        conditions: ['audit_required', 'data_masking_required'],
                    };
                }
            }

            return {
                allowed: false,
                reason: 'Insurance providers have limited data access',
                conditions: ['consent_required'],
            };
        }

        // Default: Deny access
        return {
            allowed: false,
            reason: 'No applicable policy found - default deny',
            conditions: [],
        };

    } catch (error) {
        logger.error('Policy evaluation error:', error);
        // Fail secure - deny access on error
        return {
            allowed: false,
            reason: 'Policy evaluation failed',
            conditions: [],
        };
    }
};

/**
 * Middleware to enforce access policies
 * @param {String} resource - Resource being accessed
 * @param {String} action - Action being performed
 */
const enforcePolicy = (resource, action = ACCESS_ACTIONS.READ) => {
    return async (req, res, next) => {
        try {
            const context = {
                userId: req.user?.id,
                userRole: req.user?.role_name || req.user?.roleName,
                patientId: req.params.patientId || req.params.id || req.body.patientId,
                resource,
                action,
                dataCategory: req.params.dataCategory || req.body.dataCategory || 'all_medical_data',
                metadata: {
                    emergencyOverride: req.emergencyAccess || false,
                    emergencyJustification: req.body.emergencyJustification,
                    anonymized: req.query.anonymized === 'true',
                },
            };

            const decision = await evaluatePolicy(context);

            if (decision.allowed) {
                // Attach policy decision to request for downstream use
                req.policyDecision = decision;

                logger.info(`Access granted: ${decision.reason}`);
                return next();
            } else {
                logger.warn(`Access denied: ${decision.reason}`);

                return res.status(403).json({
                    success: false,
                    message: decision.reason,
                    conditions: decision.conditions,
                });
            }

        } catch (error) {
            logger.error('Policy enforcement error:', error);

            return res.status(500).json({
                success: false,
                message: 'Policy enforcement failed',
            });
        }
    };
};

module.exports = {
    evaluatePolicy,
    enforcePolicy,
};
