const StaffInvitation = require('../models/staff_invitation.model');
const AccountAction = require('../models/account_action.model');
const auditService = require('./audit.service');
const logger = require('../utils/logger');
const { sendEmail } = require('../config/mail');

/**
 * Staff Invitation Service
 * Handles email-based staff invitation workflow
 */
class StaffInvitationService {
    static async sendInvitationEmail(invitation, inviterName) {
        try {
            const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/staff/invitation/${invitation.token}`;

            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@healthcare.com',
                to: invitation.email,
                subject: 'You\'re Invited to Join Our Healthcare Team',
                html: `
                    <h2>Welcome to Our Healthcare Team!</h2>
                    <p>Hi there,</p>
                    <p>${inviterName} has invited you to join our healthcare management system as a <strong>${invitation.role}</strong>.</p>
                    ${invitation.invitation_message ? `<p><em>"${invitation.invitation_message}"</em></p>` : ''}
                    <p>Click the button below to accept your invitation and create your account:</p>
                    <p style="margin: 30px 0;">
                        <a href="${invitationUrl}" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            Accept Invitation
                        </a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p><a href="${invitationUrl}">${invitationUrl}</a></p>
                    <p><strong>This invitation will expire on ${new Date(invitation.expires_at).toLocaleDateString()}.</strong></p>
                    <p>If you have any questions, please contact your administrator.</p>
                    <hr>
                    <p style="color: #666; font-size: 12px;">This is an automated email. Please do not reply.</p>
                `
            };

            await sendEmail({
                to: invitation.email,
                subject: 'You\'re Invited to Join Our Healthcare Team',
                html: mailOptions.html,
                text: `Hi there, ${inviterName} has invited you to join our healthcare management system as a ${invitation.role}. Accept your invitation here: ${invitationUrl}`
            });
            return true;
        } catch (error) {
            logger.error('Error sending invitation email:', error);
            return false;
        }
    }

    /**
     * Send welcome email with login details
     */
    static async sendWelcomeEmail(user, role) {
        try {
            const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@healthcare.com',
                to: user.email,
                subject: 'Welcome to Secure Healthcare - Account Activated',
                html: `
                    <h2>Account Activated Successfully!</h2>
                    <p>Hello ${user.first_name},</p>
                    <p>Your account has been successfully created and activated.</p>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Username/Email:</strong> ${user.email}</p>
                        <p><strong>Role:</strong> ${role}</p>
                        <p><em>(You have already set your password during registration)</em></p>
                    </div>

                    <p>You can now log in to the system:</p>
                    <p style="margin: 30px 0;">
                        <a href="${loginUrl}" style="background-color: #007bff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block;">
                            Login to Dashboard
                        </a>
                    </p>
                    
                    <p>If you have any issues, please contact the administrator.</p>
                `
            };

            await sendEmail({
                to: user.email,
                subject: 'Welcome to Secure Healthcare - Account Activated',
                html: mailOptions.html,
                text: `Hello ${user.first_name}, Your account has been successfully created and activated. You can now log in at ${loginUrl}`
            });
            logger.info('Staff welcome email sent');
        } catch (error) {
            logger.error('Error sending welcome email:', error);
            // Don't throw - non-critical
        }
    }

    /**
     * Invite a new staff member
     */
    static async inviteStaff({ email, role, organizationId, invitedBy, actorRole, invitationMessage = null, inviterName }) {
        try {
            const { staffRoleAllowed, canManageOrganization } = require('../middleware/clinical-access.middleware');
            if (!staffRoleAllowed(actorRole, role) || !await canManageOrganization({ id: invitedBy, roleName: actorRole }, organizationId)) {
                throw Object.assign(new Error('Invitation outside administrative scope'), { statusCode: 403 });
            }
            // Check if email already has a pending invitation
            const hasPending = await StaffInvitation.hasPendingInvitation(email);
            if (hasPending) {
                throw new Error('This email already has a pending invitation');
            }

            const db = require('../config/db');

            // Check if user already exists
            const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
            let userId;

            if (userCheck.rows.length > 0) {
                // User already exists, prevent invitation from being sent as per requirements
                throw new Error('A user with this email already exists');
            }

            // Create new user immediately as PENDING
            // Generate random password
            const randomPassword = require('crypto').randomBytes(8).toString('hex');
            const { hashPassword } = require('../services/encryption.service');
            const passwordHash = await hashPassword(randomPassword);

            // Get role ID
            const roleRes = await db.query('SELECT id FROM roles WHERE name = $1', [role.toLowerCase()]);
            if (roleRes.rows.length === 0) {
                throw new Error(`Invalid role: ${role}`);
            }
            const roleId = roleRes.rows[0].id;

            const userQuery = `
                INSERT INTO users (email, password_hash, role_id, is_verified, status, first_name, last_name)
                VALUES ($1, $2, $3, false, 'pending', 'Staff', 'Member')
                RETURNING id;
            `;
            // Default name 'Staff Member' until they accept and update it

            const userResult = await db.query(userQuery, [email, passwordHash, roleId]);
            userId = userResult.rows[0].id;

            // Create/Ensure Staff Organization Mapping
            if (organizationId) {
                // Check if mapping exists
                const mappingCheck = await db.query(
                    'SELECT id FROM staff_org_mapping WHERE user_id = $1 AND organization_id = $2',
                    [userId, organizationId]
                );

                if (mappingCheck.rows.length === 0) {
                    // Get role ID again if needed (or pass it)
                    const roleRes = await db.query('SELECT id FROM roles WHERE name = $1', [role.toLowerCase()]);
                    const roleId = roleRes.rows[0].id;

                    await db.query(
                        `INSERT INTO staff_org_mapping (user_id, organization_id, role_id, status)
                         VALUES ($1, $2, $3, 'active')`,
                        [userId, organizationId, roleId]
                    );
                }
            }

            // Create invitation
            const invitation = await StaffInvitation.create({
                email,
                role,
                organizationId,
                invitedBy,
                invitationMessage,
                expiresInDays: 7
            });

            // Send invitation email
            invitation.deliveryStatus = await this.sendInvitationEmail(invitation, inviterName) ? 'sent' : 'failed';
            invitation.invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/staff/invitation/${invitation.token}`;

            // Log the action to account actions
            await AccountAction.log({
                userId: invitedBy,
                actionType: 'invite',
                actionBy: invitedBy,
                notes: `Invited ${email} as ${role}`,
                metadata: { email, role, invitationId: invitation.id, createdUserId: userId }
            });

            // Log to system audit logs so it appears on the Audit Logs UI
            await auditService.createAuditLog({
                userId: invitedBy,
                action: 'staff_onboard',
                entityType: 'staff_invitation',
                entityId: invitation.id,
                purpose: `Invited ${email} as ${role}`,
                ipAddress: 'System', // Ideally from req.ip, but System is acceptable for now
                metadata: { email, role, targetUserId: userId }
            });

            logger.info('Staff invitation created');
            return invitation;
        } catch (error) {
            logger.error('Error inviting staff:', error);
            throw error;
        }
    }

    /**
     * Validate invitation token
     */
    static async validateInvitation(token) {
        try {
            const validation = await StaffInvitation.validate(token);
            return validation;
        } catch (error) {
            logger.error('Error validating invitation:', error);
            throw error;
        }
    }

    /**
     * Accept invitation and update user account
     */
    static async acceptInvitation(token, userData) {
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) throw Object.assign(new Error('Invalid invitation'),{statusCode:400});
        const validation = require('../utils/validators').validatePassword(userData.password);
        if (!validation.isValid) throw Object.assign(new Error('Password does not meet requirements'),{statusCode:400});
        const passwordHash = await require('./encryption.service').hashPassword(userData.password);
        const db = require('../config/db');
        const { staffRoleAllowed } = require('../middleware/clinical-access.middleware');
        const accepted = await db.transaction(async client => {
            const locked = await client.query('SELECT * FROM staff_invitations WHERE token=$1 FOR UPDATE',[token]);
            const invitation = locked.rows[0];
            if (!invitation || invitation.status !== 'pending' || new Date(invitation.expires_at) <= new Date()) throw Object.assign(new Error('Invitation is no longer valid'),{statusCode:409});
            const inviter = (await client.query(`SELECT u.id,u.status,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1`,[invitation.invited_by])).rows[0];
            if (!inviter || inviter.status !== 'active' || !staffRoleAllowed(inviter.role_name,invitation.role)) throw Object.assign(new Error('Invitation is no longer authorized'),{statusCode:403});
            if (inviter.role_name !== 'system_admin') {
                const org = await client.query('SELECT id FROM organizations WHERE id=$1 AND admin_user_id=$2',[invitation.organization_id,inviter.id]);
                if (!org.rows.length) throw Object.assign(new Error('Invitation is outside administrative scope'),{statusCode:403});
            }
            const role = (await client.query('SELECT id FROM roles WHERE name=$1',[invitation.role])).rows[0];
            if (!role) throw Object.assign(new Error('Invalid invitation role'),{statusCode:400});
            let user = (await client.query('SELECT id,status,role_id FROM users WHERE email=$1 FOR UPDATE',[invitation.email])).rows[0];
            if (user && (user.status !== 'pending' || user.role_id !== role.id)) throw Object.assign(new Error('Account cannot accept this invitation'),{statusCode:409});
            if (user) {
                user = (await client.query(`UPDATE users SET password_hash=$1,first_name=$2,last_name=$3,status='active',account_status='active',is_verified=true,updated_at=NOW()
                    WHERE id=$4 RETURNING id,email,first_name,last_name,status`,[passwordHash,userData.firstName,userData.lastName,user.id])).rows[0];
            } else {
                user = (await client.query(`INSERT INTO users(email,password_hash,first_name,last_name,role_id,status,is_verified)
                    VALUES($1,$2,$3,$4,$5,'active',true) RETURNING id,email,first_name,last_name,status`,[invitation.email,passwordHash,userData.firstName,userData.lastName,role.id])).rows[0];
            }
            if (invitation.organization_id) await client.query(`INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,$3,'active')
                ON CONFLICT(user_id,organization_id) DO UPDATE SET status='active',role_id=EXCLUDED.role_id`,[user.id,invitation.organization_id,role.id]);
            const consumed = await client.query("UPDATE staff_invitations SET status='accepted',accepted_by=$2,accepted_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id",[invitation.id,user.id]);
            if (!consumed.rows.length) throw Object.assign(new Error('Invitation is no longer valid'),{statusCode:409});
            await client.query("INSERT INTO account_actions(user_id,action_type,action_by,notes,metadata) VALUES($1,'invite_accept',$1,'Invitation accepted',$2)",[user.id,JSON.stringify({invitationId:invitation.id})]);
            return {user,role:invitation.role};
        });
        await this.sendWelcomeEmail(accepted.user,accepted.role);
        return accepted.user;
    }

    /**
     * Resend invitation email
     */
    static async resendInvitation(invitationId, inviterName) {
        try {
            let invitation = await StaffInvitation.getById(invitationId);

            if (!invitation) {
                throw new Error('Invitation not found');
            }

            // For expired or cancelled invitations, reset them to pending with a new token
            const allowedStatuses = ['pending', 'expired'];
            if (!allowedStatuses.includes(invitation.status)) {
                throw new Error(`Cannot resend ${invitation.status} invitation`);
            }

            // Reset if expired or cancelled
            if (invitation.status === 'expired' || new Date(invitation.expires_at) <= new Date()) {
                invitation = await StaffInvitation.resetForResend(invitationId);
                if (!invitation) throw Object.assign(new Error('Invitation has already been processed'),{statusCode:409});
            }

            // Send email again
            invitation.deliveryStatus = await this.sendInvitationEmail(invitation, inviterName) ? 'sent' : 'failed';
            invitation.invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/staff/invitation/${invitation.token}`;

            logger.info('Staff invitation resent');
            return invitation;
        } catch (error) {
            logger.error('Error resending invitation:', error);
            throw error;
        }
    }

    /**
     * Cancel an invitation
     */
    static async cancelInvitation(invitationId, cancelledBy, reason = null) {
        try {
            const invitation = await StaffInvitation.cancel(invitationId, cancelledBy, reason);

            if (!invitation) {
                throw new Error('Invitation not found or already processed');
            }

            // Log the action
            await AccountAction.log({
                userId: cancelledBy,
                actionType: 'cancel_invite',
                actionBy: cancelledBy,
                reason: reason || 'Invitation cancelled',
                metadata: { invitationId, email: invitation.email }
            });

            logger.info(`Invitation ${invitationId} cancelled by ${cancelledBy}`);
            return invitation;
        } catch (error) {
            logger.error('Error cancelling invitation:', error);
            throw error;
        }
    }

    /**
     * Get all invitations (with filters)
     */
    static async getInvitations(filters = {}) {
        try {
            return await StaffInvitation.getAll(filters);
        } catch (error) {
            logger.error('Error getting invitations:', error);
            throw error;
        }
    }

    /**
     * Get invitation statistics
     */
    static async getStats(filters = {}) {
        try {
            return await StaffInvitation.getStats(filters);
        } catch (error) {
            logger.error('Error getting invitation stats:', error);
            throw error;
        }
    }

    /**
     * Clean up expired invitations (scheduled job)
     */
    static async cleanupExpired() {
        try {
            const count = await StaffInvitation.cleanupExpired();
            logger.info(`Marked ${count} expired invitations`);
            return count;
        } catch (error) {
            logger.error('Error cleaning up expired invitations:', error);
            throw error;
        }
    }
}

module.exports = StaffInvitationService;
