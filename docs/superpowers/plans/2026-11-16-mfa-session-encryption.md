# MFA session and encryption implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Require authenticator MFA or a verified passkey, remove persistent browser bearer credentials, and support recoverable encryption-key rotation.

**Architecture:** Express and PostgreSQL own authentication state and transactional security evidence. React uses same-origin HttpOnly sessions and transient MFA forms. A bounded application keyring retains existing encrypted file formats and backup-key separation.

**Tech Stack:** Node 24, Express 4, PostgreSQL, React 19, WebAuthn, platform crypto, Vitest and Node integration tests.

**Spec:** `docs/superpowers/specs/2026-11-16-mfa-session-encryption-design.md` (approved 16 November 2026).

## Global Constraints

- Work only in the isolated `security/mfa-session-encryption` checkout; preserve the original working tree and migration 035.
- Online services are accessed only through the user's Chrome browser.
- Keep current role, clinical, consent, theme and account-verification behavior.
- Production MFA cannot be disabled by a development fixture option.
- Run tests with synthetic identities in constrained offline containers; never use production secrets or patient data.
- Never rotate or retire live encryption keys as an incidental code change.

## Review Focus

- Interrupted enrollment/recovery delivery must preserve the previous working factor and allow safe restart.
- A fresh password ticket must not reset the account's MFA guessing budget.
- Concurrent successful codes or passkey assertions must produce only one committed session.
- A stale cookie, legacy bearer or offline reload must not silently restore password-only access.
- Historical ciphertext and mixed-key backups must remain recoverable after active-key changes.

## File responsibilities and interfaces

`backend/src/services/application-keys.js` owns `getApplicationKeys(env): {activeId,activeKey,keys}` validation. `encryption.service.js` exposes context-bound secret encryption and legacy decryption; `file.crypto.js` keeps SHMSENC1/2 and bounded retained-key decryption. `backend/src/services/totp.service.js` owns RFC-compatible codes and setup URI generation.

`backend/src/services/auth-session.service.js` owns cookie/bearer transport and transactional full-session issuance; `backend/src/services/mfa.service.js` owns restricted challenges, account/IP throttles, enrollment/recovery and operation-bound step-up. `backend/src/modules/auth/mfa.controller.js` and routes expose only these restricted operations. Existing auth/passkey controllers delegate issuance and preserve user response shape after full authentication. `auth.middleware.js` enforces server-stored MFA assurance and CSRF.

`backend/src/database/ordered/036_mfa_sessions.sql` adds private authentication state and session metadata without modifying previous migrations. Catalog/grants/data inventory and cleanup reflect the new state.

`frontend/src/components/auth/MfaChallenge.jsx` handles setup, challenge, recovery and acknowledgment in memory. AuthContext, shared API client, authApi, Login and Register move together to cookies and readable CSRF bootstrap. A non-secret sign-out marker handles offline logout.

### Task 1: Encryption and authenticator primitives

- [x] Add failing unit tests for all six RFC 6238 SHA-1 vectors, malformed codes, neighboring steps, wrong context, old/new encryption, duplicate/missing keys and mixed-key file decryption.
- [x] Run focused tests in the offline container; confirm the new interfaces are missing.
- [x] Implement `getApplicationKeys`, `generateSecret`, `generateTotp(secret,time,{digits})`, `verifyTotp(secret,code,{now,lastStep})`, `provisioningUri(secret,account)`, `encryptSecret(value,context)` and `decryptSecret(envelope,context)`.
- [x] Update file readers/writers, direct-key migration tooling and backup independence validation across all retained keys. Keep existing envelope validators compatible.
- [x] Rerun focused tests, then commit explicit paths.

### Task 2: Transactional MFA, session and passkey backend

- [x] Add database integration tests for setup interruption, acknowledgment activation, recovery replacement, five failures across tickets, step-up, concurrent replay and audit/commit failure.
- [x] Confirm failures before implementing the new tables/services.
- [x] Add migration, catalog/grants/inventory, cleanup and backend state machine with five-minute hashed tickets, 5/15-minute account and 20/15-minute IP limits, ten hashed recovery codes and strict transaction-bound audit evidence.
- [x] Introduce session-bound CSRF and host cookies; require persisted MFA metadata on protected routes, exact browser Origin on authentication and unsafe cookie requests, reject duplicate or mixed credentials, and send cookies only after commit.
- [x] Require WebAuthn user verification on options and verification, use operation-specific database challenges, require fresh factor proof for passkey registration and reuse the transactional session issuer.
- [x] Update both compatibility response adapters and registration/staff boundaries. Test that legacy tokens and restricted tickets cannot reach clinical APIs.
- [x] Run focused integration/unit tests and commit explicit paths.

### Task 3: Cookie client and MFA interface

- [x] Add failing frontend behavior checks for setup/code/recovery/acknowledgment, registration transition, cookie bootstrap, CSRF header, public versus protected 401, passkey redirects and offline logout reload.
- [x] Implement the shared MFA form with local QR rendering and current theme/accessibility; keep secrets in component memory only.
- [x] Replace tokenManager/localStorage credentials with cookie/CSRF helpers, clear legacy tokens, coordinate AuthContext/client/authApi and wire Login/Register including optional fresh-proof passkey setup.
- [x] Run frontend tests, lint, theme/font checks and build; commit explicit paths.

### Task 4: Verification, provider evidence and release guidance

- [x] Record Supabase project-specific settings separately from provider at-rest assurance; verify API TLS compatibility before database-wide SSL enforcement.
- [x] Add dry-run key rotation/mixed-key recovery guidance and coordinated schema/API/UI activation, session invalidation and fail-closed rollback instructions.
- [x] Run appropriate backend/frontend regression suites and governance checks using available offline dependencies, documenting any lockfile mismatch rather than claiming exact-version validation.
- [x] Obtain an independent source review, resolve actionable findings, and rerun checks affected by fixes.
- [x] Verify original working-tree status and HEAD are unchanged and mutations remain scoped to the isolated checkout; report code/test/release status accurately.

Execution follows the user's explicit approval to implement in this session. Production credential enrollment, key rotation and deployment are separate from implementing and validating the change.
