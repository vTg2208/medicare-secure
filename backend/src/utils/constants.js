// System-wide constants

// User roles
const ROLES = {
    PATIENT: 'patient',
    DOCTOR: 'doctor',
    NURSE: 'nurse',
    RECEPTIONIST: 'receptionist',
    LAB_TECHNICIAN: 'lab_technician',
    RADIOLOGIST: 'radiologist',
    PHARMACIST: 'pharmacist',
    HOSPITAL_ADMIN: 'hospital_admin',
    SYSTEM_ADMIN: 'system_admin',
    INSURANCE_PROVIDER: 'insurance_provider',
    RESEARCHER: 'researcher',
    COMPLIANCE_OFFICER: 'compliance_officer',
};

// User statuses
const USER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    PENDING: 'pending',
};

// Organization types
const ORGANIZATION_TYPES = {
    HOSPITAL: 'hospital',
    CLINIC: 'clinic',
    PHARMACY: 'pharmacy',
    LABORATORY: 'laboratory',
    IMAGING_CENTER: 'imaging_center',
};

// Organization statuses
const ORGANIZATION_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    SUSPENDED: 'suspended',
};

// Staff statuses
const STAFF_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ON_LEAVE: 'on_leave',
};

// OTP purposes
const OTP_PURPOSE = {
    REGISTRATION: 'registration',
    LOGIN: 'login',
    PASSWORD_RESET: 'password_reset',
    PHONE_VERIFICATION: 'phone_verification',
};

// Audit actions
const AUDIT_ACTIONS = {
    USER_REGISTER: 'user_register',
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    USER_UPDATE: 'user_update',
    USER_DELETE: 'user_delete',
    PASSWORD_CHANGE: 'password_change',
    PASSWORD_RESET: 'password_reset',
    OTP_GENERATE: 'otp_generate',
    OTP_VERIFY: 'otp_verify',
    ROLE_ASSIGN: 'role_assign',
    STAFF_ONBOARD: 'staff_onboard',
    STAFF_DEACTIVATE: 'staff_deactivate',
    ORG_REGISTER: 'org_register',
    ORG_UPDATE: 'org_update',
    ACCESS_DENIED: 'access_denied',
    EMERGENCY_ACCESS: 'emergency_access',
    CONSENT_GRANT: 'consent_grant',
    CONSENT_REVOKE: 'consent_revoke',
    CONSENT_VIEW: 'consent_view',
    CONSENT_EXPIRED: 'consent_expired',
    DATA_ACCESS: 'data_access',
    DATA_MODIFY: 'data_modify',
};

// Security event types
const SECURITY_EVENT_TYPES = {
    FAILED_LOGIN: 'failed_login',
    ACCOUNT_LOCKED: 'account_locked',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity',
    PASSWORD_RESET: 'password_reset',
    ROLE_CHANGE: 'role_change',
};

// Security event severity
const SECURITY_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

// Access control actions
const ACCESS_ACTIONS = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
};

// HTTP status codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

// Error messages
const ERROR_MESSAGES = {
    // Authentication
    INVALID_CREDENTIALS: 'Invalid email/phone or password',
    ACCOUNT_NOT_VERIFIED: 'Account not verified. Please verify your OTP',
    ACCOUNT_LOCKED: 'Account locked due to multiple failed login attempts',
    ACCOUNT_SUSPENDED: 'Account has been suspended',
    INVALID_TOKEN: 'Invalid or expired token',
    TOKEN_REQUIRED: 'Authentication token required',

    // Authorization
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions to perform this action',
    ACCESS_DENIED: 'Access denied',

    // OTP
    INVALID_OTP: 'Invalid OTP code',
    OTP_EXPIRED: 'OTP has expired',
    OTP_MAX_ATTEMPTS: 'Maximum OTP attempts exceeded',

    // User
    USER_NOT_FOUND: 'User not found',
    USER_ALREADY_EXISTS: 'User with this email/phone already exists',
    DUPLICATE_HEALTH_ID: 'Duplicate health ID detected',

    // Organization
    ORG_NOT_FOUND: 'Organization not found',
    ORG_ALREADY_EXISTS: 'Organization with this license number already exists',

    // Validation
    INVALID_INPUT: 'Invalid input data',
    REQUIRED_FIELDS_MISSING: 'Required fields are missing',
    INVALID_EMAIL: 'Invalid email format',
    INVALID_PHONE: 'Invalid phone number format',
    WEAK_PASSWORD: 'Password does not meet security requirements',

    // General
    INTERNAL_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database operation failed',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
};

// Success messages
const SUCCESS_MESSAGES = {
    USER_REGISTERED: 'User registered successfully',
    OTP_SENT: 'OTP sent successfully',
    OTP_VERIFIED: 'OTP verified successfully',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    PASSWORD_UPDATED: 'Password updated successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    ORG_REGISTERED: 'Organization registered successfully',
    STAFF_ONBOARDED: 'Staff member onboarded successfully',
    STAFF_DEACTIVATED: 'Staff member deactivated successfully',
    CONSENT_GRANTED: 'Consent granted successfully',
    CONSENT_REVOKED: 'Consent revoked successfully',
};

// Default access policy (DENY ALL)
const DEFAULT_ACCESS_POLICY = 'DENY';

// Session configuration
const SESSION_CONFIG = {
    TIMEOUT_MINUTES: 30,
    MAX_CONCURRENT_SESSIONS: 3,
};

// Rate limiting
const RATE_LIMITS = {
    LOGIN_ATTEMPTS: 5,
    LOGIN_WINDOW_MINUTES: 15,
    OTP_ATTEMPTS: 3,
    OTP_WINDOW_HOURS: 1,
    API_REQUESTS: 100,
    API_WINDOW_MINUTES: 15,
};

module.exports = {
    ROLES,
    USER_STATUS,
    ORGANIZATION_TYPES,
    ORGANIZATION_STATUS,
    STAFF_STATUS,
    OTP_PURPOSE,
    AUDIT_ACTIONS,
    SECURITY_EVENT_TYPES,
    SECURITY_SEVERITY,
    ACCESS_ACTIONS,
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    DEFAULT_ACCESS_POLICY,
    SESSION_CONFIG,
    RATE_LIMITS,
};
