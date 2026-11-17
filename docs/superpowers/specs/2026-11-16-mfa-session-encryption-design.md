# MFA session and encryption design

Date: 16 November 2026

## Intent and scope

Close the remaining authentication, browser session-storage and encryption-assurance gaps while preserving Medicare's current theme, roles, patient authorization, clinical workflows and account verification. The user selected authenticator-app MFA with recovery codes and verified passkeys as an alternative. Existing users enroll at their next password sign-in.

Implementation takes place in an isolated checkout. The original working tree, its staged state, uncommitted changes and in-progress migration 035 remain untouched. Online services are accessed only through the user's Chrome browser. The downloaded published main snapshot is revision `9eba84477752173e2143c92998269e2a64014031`; local remote refs are stale and must not be used as a claim of that baseline.

## Approaches considered

1. Authenticator codes plus verified passkeys: selected by the user. Password users complete a time-based code challenge; a passkey whose authenticator verifies the user provides the alternative. Recovery does not depend on an email provider.
2. Password plus authenticator code for every login: stronger uniform sequencing but removes the current passwordless passkey experience. The user selected the first approach.
3. Email or SMS codes as the primary MFA mechanism: rejected for this change because live mail delivery is not established and SMS is a placeholder. Existing email account verification remains separate from sign-in MFA.

## MFA contract

Password verification must no longer issue an unrestricted session by itself. After checking verification, account state and lockout, it creates a short-lived random authentication ticket, stores only its hash, and returns a restricted next step. The ticket authorizes only MFA enrollment or verification for that account; it is not accepted by clinical or administrative APIs. Challenge state is database-backed, single-use, expires after five minutes and is limited to five failed verification attempts. Concurrent requests cannot reuse a ticket, accepted authenticator time step or recovery code.

Use RFC 6238 interoperable six-digit authenticator codes with a 30-second step and at most one neighboring step in either direction. Use the platform crypto HMAC and timing-safe primitives, checked against published RFC vectors. Store random per-user seeds under authenticated application encryption bound to the user and purpose. Never log seeds, codes, tickets or provisioning URLs. Show a QR code and a manual setup secret; do not send provisioning data to an external QR service.

Users without an enrolled factor receive only the restricted setup state. The state machine is pending setup, verified setup, recovery-code acknowledgement, then atomic activation and session issuance. Generate ten random, high-entropy recovery codes after code verification; persist hashes and show the values once. An interrupted delivery requires a fresh setup/code set rather than pretending the user saved unavailable values. No full session or active replacement factor exists until acknowledgement commits. Do not store recovery values in browser storage. Password plus one unused recovery code starts a restricted authenticator-replacement flow; it cannot silently disable MFA or continue as a password-only session. Consume the recovery code atomically when authorizing replacement. Replace the seed only after confirming the new authenticator and acknowledging the new codes; invalidate the old factor/challenges and other sessions atomically. Cancellation or expiry preserves the previous working factor, although a consumed recovery code stays consumed.

Implementation decisions: MFA failures share database-backed account and IP windows across tickets (five account failures per fifteen minutes and twenty IP failures per fifteen minutes), in addition to the per-ticket limit. Bound outstanding tickets per account, expire abandoned state, and clean it with the existing session cleanup lifecycle. Factor lockout must not revoke a working factor. Adding a passkey, replacing an authenticator or regenerating recovery codes requires fresh existing-factor proof in a single-use, operation-bound step-up authorization lasting at most five minutes. An existing session alone is insufficient. First enrollment deliberately trusts the holder of the verified account's current password; this is the bootstrap boundary implied by next-sign-in enrollment, and must be stated in rollout guidance.

Passkey registration and authentication request and verify user verification as required. A cancelled, unverified or wrong-origin credential does not issue a session. Existing compatible passkeys remain usable; users whose authenticator cannot verify them retain the password-plus-authenticator path. Database-backed, operation-specific challenges must not collide across registration, login or concurrent attempts. Existing user edits to passkey challenge handling are not copied from the original working tree; any necessary equivalent implementation is independently reviewed in this branch.

All account roles follow the same full-session assurance requirement. Existing pre-MFA sessions are invalidated during activation rather than grandfathered into protected APIs. MFA enforcement is mandatory for the production configuration. Test/development compatibility, if configurable for legacy fixtures, is explicit and cannot disable production enforcement.

## Browser session contract

Use a host-only `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` session cookie in production, with a `__Host-` name and no Domain attribute. Local HTTP development uses a separate non-production cookie name. Keep the database session hash, expiration, revocation, device and inactivity checks. Issue the cookie only after the selected MFA requirement succeeds and rotate session identity at that boundary.

The normal browser login and passkey responses contain user information, not access or refresh bearer tokens. The frontend neither stores nor retrieves credentials from localStorage or sessionStorage; it removes the legacy stored token. API calls use the existing same-origin proxy. Initial page load verifies the server cookie, and protected 401 responses return to sign-in without misclassifying public form errors.

Cookie-authenticated state changes require a session-bound CSRF value in a custom header, checked against the current session and a readable host-only CSRF cookie. Validate the exact allowed Origin on browser authentication and unsafe cookie requests, reject cross-site requests and ambiguous/duplicate authentication cookies, and do not trust a client identity or MFA flag. Public password/MFA endpoints retain their validation and abuse controls. Keep authenticated staff patient registration, exports, downloads, messages and invitations working through the shared client.

Pre-authentication tickets are random opaque values returned only to the login form's in-memory state and sent in a dedicated header to restricted MFA endpoints. They expire on reload rather than persisting in web storage. Setup secrets and recovery values remain in that same transient form state. Public authentication and restricted-ticket requests require the configured browser Origin; the same-origin proxy must preserve it. Cookie issuance supplies a fresh readable CSRF cookie in the same response, allowing the shared client to read it for subsequent unsafe requests. Duplicate cookies, simultaneous cookie and bearer authentication, and cross-origin browser authentication are rejected. Full sessions persist server-side MFA method and verification time; JWT validity alone cannot satisfy assurance.

Explicit non-browser bearer clients retain their existing API transport only after the same MFA flow, using an explicitly documented response negotiation on requests without browser Origin or cookies. Browser requests always use cookies and never receive bearer credentials; response negotiation cannot disable Origin or CSRF checks. Both compatibility login adapters must represent restricted next steps instead of assuming every successful response contains a user, and must stop exposing browser token aliases. No legacy cookie-to-bearer exchange is provided.

Logout revokes the server session and clears both cookies with matching attributes. An offline failure hides protected UI and records only a non-secret signed-out marker so a reload does not silently restore the session; retry server revocation when connectivity returns. Do not claim successful server revocation if the request failed.

## Encryption and key operations

Keep existing authenticated encryption, private hosted ciphertext storage, encrypted backups, verified database TLS and HTTPS. Verify the actual Supabase project/provider assurance through Chrome and record which evidence is project-specific and which is a provider statement. Do not relabel ordinary clinical columns as application-encrypted, enable paid features, migrate clinical data or change cloud accounts merely to close a documentation status.

Add a bounded, versioned application-key configuration with a designated active key and retained decryption keys. Preserve existing ciphertext readability and the independent backup key. New MFA secrets use purpose/user-bound authenticated encryption. Validate malformed, duplicate, missing-active and unsafe key configurations without logging values. Add a dry-run-first operator procedure and checks for rotation, historical-key preservation and recovery. Never replace a live encryption key or delete a retained key without verifying recovery and obtaining the required action-time approval.

Implementation decision: keep existing SHMSENC1/SHMSENC2 file envelopes and their storage/backup validators unchanged. File decryption tries only a small configured set of retained application keys and accepts a key only after authenticated decryption succeeds; new file writes use the designated active key. New database-secret envelopes carry a key identifier and authenticated purpose/user context, with explicit legacy database-secret readers. Update direct-key consumers, file migration tooling and recovery verification together. The independent backup key must differ from every active or retained application key. Mixed-key files and database secrets are included in recovery checks; retiring a key requires an inventory proving no dependent ciphertext remains.

Provider disk encryption, organization key custody and access review cannot be proven by application tests. Where dashboard/provider evidence is unavailable, retain the precise pending boundary instead of asserting completion.

## Compatibility and release

Use a new ordered migration without editing applied migrations or reusing the original working tree's migration 035. Update the catalog, runtime grants and governance metadata for added authentication tables. Password registration, email verification, optional passkey setup, staff onboarding and role redirects must reach the new MFA/cookie flow without exposing a pre-authentication session to normal routes.

Verified patient registration transitions to restricted MFA enrollment, then a full cookie session, then optional passkey setup with fresh factor proof. Staff-created patients complete enrollment on their own first sign-in. Keep the existing public bot challenge and staff exemption checks at the appropriate authenticated boundary. Update registration auto-login, compatibility response wrappers, shared-client unauthorized handling and AuthContext together. Challenge/factor changes, session issuance and strict audit evidence use one database transaction and `logAuditEvent(..., client)`; cookies are sent only after commit. Best-effort audit helpers are insufficient for these security transitions.

Prepare schema and compatible UI/API together, with explicit rollout and rollback instructions. Deployment and live key changes are separate consequential operations; this design does not authorize creating a user's personal authenticator credential or rotating production secrets on their behalf. Verify that a rollback cannot restore password-only access or make retained ciphertext unreadable.

## Acceptance

- Password alone, pre-auth tickets, expired/replayed authenticator codes, used recovery codes and unverified passkeys cannot access protected APIs.
- Enrollment, recovery/replacement, challenge consumption, session issuance and evidence are atomic under concurrent requests and database failure.
- Browser storage and normal authentication JSON contain no bearer credentials. Cookie flags, CSRF and Origin checks pass positive and negative tests through the same-origin proxy.
- Existing role, consent, patient/organization isolation, registration, clinical and logout regressions remain passing. The current light/dark theme and accessible form behavior remain intact.
- Old and new ciphertext decrypt only with the permitted key/context; tampering, wrong keys and wrong users fail. Rotation checks preserve recovery compatibility.
- Run local tests with synthetic identities in an offline constrained environment; do not test against live patient data or copy production secrets into fixtures.
- Record provider assurance, test evidence, remaining owner responsibilities and the original-worktree integrity check separately.

## Approval

The MFA approach is user-selected. This concrete design is submitted for approval before product-code changes because it changes the sign-in and recovery behavior for every role.
