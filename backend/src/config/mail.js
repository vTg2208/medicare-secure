const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const demo = process.env.DEMO_MODE === 'true';

// Email transporter configuration
const transporter = demo ? null : nodemailer.createTransport(process.env.NODE_ENV === 'test' ? { jsonTransport: true } : {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  ...(process.env.EMAIL_USER && { auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  } }),
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// Verify transporter configuration (disabled in development)
if (!demo && process.env.NODE_ENV === 'production') {
  transporter.verify((error, success) => {
    if (error) {
      logger.error('Email transporter configuration error:', error);
    } else {
      logger.info('Email server is ready to send messages');
    }
  });
} else if (!demo) {
  logger.info('Email verification skipped in development mode');
}

/**
 * Send email
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Email subject
 * @param {String} options.text - Plain text content
 * @param {String} options.html - HTML content
 * @returns {Promise} Send result
 */
const sendEmail = async ({ to, subject, text, html }) => {
  if (demo) {
    throw Object.assign(new Error('Email delivery is unavailable in the public demo'), {
      statusCode: 503,
      code: 'DEMO_FEATURE_DISABLED',
    });
  }
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@healthcare.com',
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully:', { to, subject, messageId: info.messageId });
    return info;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Email delivery failed; configure a local SMTP server for development');
      throw error;
    }
    logger.error('Email sending failed:', { to, subject, error: error.message });
    throw error;
  }
};

/**
 * Send OTP email
 * @param {String} email - Recipient email
 * @param {String} otp - OTP code
 * @param {String} purpose - Purpose of OTP
 * @returns {Promise} Send result
 */
const sendOTPEmail = async (email, otp, purpose = 'verification') => {
  const subject = 'Your Healthcare System Verification Code';
  const text = `Your OTP for ${purpose} is: ${otp}. This code will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Healthcare System</h2>
      <p>Your verification code for ${purpose} is:</p>
      <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      <p style="color: #7f8c8d;">This code will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>
      <p style="color: #e74c3c; font-size: 12px;">If you did not request this code, please ignore this email.</p>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send visit approval email with visit code
 * @param {String} email - Patient email
 * @param {Object} visitData - Visit information
 * @returns {Promise} Send result
 */
const sendVisitApprovalEmail = async (email, visitData) => {
  const { visit_code, hospital_name, reason } = visitData;
  const subject = `Visit Approved - ${hospital_name}`;
  const text = `Your visit has been approved!\n\nVisit Code: ${visit_code}\nHospital: ${hospital_name}\nReason: ${reason}\n\nPlease use this 6-digit code to check in when you arrive at the hospital.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #27ae60;">✅ Visit Approved</h2>
      <p>Your visit request has been approved by <strong>${hospital_name}</strong>.</p>
      
      <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">Visit Details</h3>
        <p><strong>Visit Code:</strong> <span style="font-size: 48px; color: #27ae60; font-weight: bold; letter-spacing: 8px; display: block; margin: 20px 0;">${visit_code}</span></p>
        <p><strong>Hospital:</strong> ${hospital_name}</p>
        <p><strong>Reason:</strong> ${reason}</p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <p style="margin: 0;"><strong>📋 Next Steps:</strong></p>
        <ol style="margin: 10px 0;">
          <li>Arrive at the hospital</li>
          <li>Enter your <strong>6-digit visit code ${visit_code}</strong> to check in</li>
          <li>Wait for your assigned doctor</li>
        </ol>
      </div>
      
      <p style="color: #7f8c8d; font-size: 12px;">If you have any questions, please contact ${hospital_name} directly.</p>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send visit reminder email
 * @param {String} email - Patient email
 * @param {Object} visitData - Visit information
 * @returns {Promise} Send result
 */
const sendVisitReminderEmail = async (email, visitData) => {
  const { visit_code, hospital_name, scheduled_date } = visitData;
  const subject = `Reminder: Upcoming Visit - ${hospital_name}`;
  const text = `Reminder: You have an upcoming visit.\n\nVisit Code: ${visit_code}\nHospital: ${hospital_name}\nDate: ${scheduled_date}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3498db;">🔔 Visit Reminder</h2>
      <p>This is a reminder about your upcoming visit.</p>
      <p><strong>Visit Code:</strong> ${visit_code}</p>
      <p><strong>Hospital:</strong> ${hospital_name}</p>
      <p><strong>Date:</strong> ${scheduled_date}</p>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send visit closure notification
 * @param {String} email - Patient email
 * @param {Object} visitData - Visit information
 * @returns {Promise} Send result
 */
const sendVisitClosureEmail = async (email, visitData) => {
  const { visit_code, hospital_name, status } = visitData;
  const subject = `Visit ${status === 'completed' ? 'Completed' : 'Cancelled'} - ${hospital_name}`;
  const text = `Your visit has been ${status}.\n\nVisit Code: ${visit_code}\nHospital: ${hospital_name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${status === 'completed' ? '#27ae60' : '#e74c3c'};">
        ${status === 'completed' ? '✅ Visit Completed' : '❌ Visit Cancelled'}
      </h2>
      <p>Your visit at <strong>${hospital_name}</strong> has been ${status}.</p>
      <p><strong>Visit Code:</strong> ${visit_code}</p>
      <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
        ${status === 'completed' ? 'Thank you for choosing our healthcare services.' : 'If you have questions about this cancellation, please contact the hospital.'}
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Send notification to admins about a new doctor registration
 * @param {Object} doctorData - Doctor information
 * @returns {Promise} Send result
 */
const sendDoctorRegistrationNotification = async (doctorData) => {
  const { email, firstName, lastName, registrationId } = doctorData;
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER; // Default to EMAIL_USER if no ADMIN_EMAIL

  const subject = `New Doctor Registration: ${firstName} ${lastName}`;
  const text = `A new doctor has registered and is pending approval.\n\nName: ${firstName} ${lastName}\nEmail: ${email}\nRegistration ID: ${registrationId}\n\nPlease log in to the admin dashboard to review and approve this account.`;
  const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #326773 0%, #438a99 100%); padding: 24px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 24px;">New Doctor Registration</h2>
            </div>
            <div style="padding: 32px; background-color: #ffffff;">
                <p style="font-size: 16px; margin-top: 0;">A new medical professional has registered on the platform and requires verification.</p>
                
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border: 1px solid #edf2f7;">
                    <h3 style="margin-top: 0; color: #326773; font-size: 18px; border-bottom: 2px solid #326773; padding-bottom: 8px; display: inline-block;">Doctor Details</h3>
                    <p style="margin: 12px 0;"><strong>Name:</strong> ${firstName} ${lastName}</p>
                    <p style="margin: 12px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 12px 0;"><strong>Registration ID:</strong> ${registrationId}</p>
                </div>
                
                <p style="font-size: 15px; line-height: 1.6;">Please review the submitted credentials and registration details in the administration portal to proceed with account activation.</p>
                
                <div style="text-align: center; margin-top: 32px;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/dashboard" style="background-color: #326773; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; transition: background-color 0.2s;">
                        Go to Admin Dashboard
                    </a>
                </div>
            </div>
            <div style="padding: 16px; background-color: #f1f5f9; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">This is an automated notification from the Secure Healthcare Management System.</p>
            </div>
        </div>
    `;

  return sendEmail({ to: adminEmail, subject, text, html });
};

/**
 * Send acceptance email to doctor
 * @param {String} email - Doctor email
 * @param {Object} userData - User information
 * @returns {Promise} Send result
 */
const sendDoctorAcceptanceEmail = async (email, userData) => {
  const { firstName, lastName } = userData;
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

  const subject = 'Your Secure Healthcare Account Approved';
  const text = `Congratulations Dr. ${lastName}, your account has been approved!\n\nYou can now log in to the healthcare management system: ${loginUrl}`;
  const html = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #326773 0%, #438a99 100%); padding: 32px; text-align: center; color: white;">
                <h2 style="margin: 0; font-size: 28px;">Account Approved</h2>
                <p style="margin-top: 8px; opacity: 0.9;">Welcome to the Medical Network</p>
            </div>
            <div style="padding: 40px; background-color: #ffffff;">
                <h3 style="margin-top: 0; font-size: 20px;">Congratulations Dr. ${lastName},</h3>
                <p style="font-size: 16px; line-height: 1.6; color: #475569;">
                    We are pleased to inform you that your registration and medical credentials have been successfully verified. 
                    Your account is now <strong>active</strong> and you can access the medical dashboard.
                </p>
                
                <div style="background-color: #f0fdfa; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #ccfbf1; text-align: center;">
                    <p style="margin: 0 0 16px 0; font-weight: 600; color: #115e59;">Ready to get started?</p>
                    <a href="${loginUrl}" style="background-color: #326773; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        Login to Dashboard
                    </a>
                </div>
                
                <p style="font-size: 15px; color: #64748b;">
                    If you have any questions or need technical assistance, please contact the hospital administration.
                </p>
            </div>
            <div style="padding: 20px; background-color: #f8fafc; text-align: center; border-top: 1px solid #edf2f7;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; 2026 Secure Healthcare Management System. All rights reserved.</p>
            </div>
        </div>
    `;

  return sendEmail({ to: email, subject, text, html });
};

module.exports = {
  transporter,
  sendEmail,
  sendOTPEmail,
  sendVisitApprovalEmail,
  sendVisitReminderEmail,
  sendVisitClosureEmail,
  sendDoctorRegistrationNotification,
  sendDoctorAcceptanceEmail,
};
