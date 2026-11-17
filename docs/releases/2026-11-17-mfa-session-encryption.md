# MFA, session and encryption verification — 17 November 2026

## Release state

The implementation is on the isolated `security/mfa-session-encryption` branch. It has not been pushed, merged or deployed. Migration 036 has not been applied to production. The application must be activated through the coordinated maintenance procedure in [the operations guide](../security/mfa-sessions-and-encryption.md). Existing owner changes in the original checkout were excluded from this branch.

The approved design is [the MFA/session/encryption specification](../superpowers/specs/2026-11-16-mfa-session-encryption-design.md). The published-main snapshot used as implementation baseline was `9eba84477752173e2143c92998269e2a64014031`, downloaded through Chrome and recorded locally as synthetic baseline `a3c5026`. That synthetic baseline must not be published as a replacement for actual main ancestry. To publish later, create a branch from the actual current remote main through Chrome and transfer only the reviewed feature changes, reconciling any intervening changes.

## Verified behavior

Password authentication grants only a restricted MFA ticket. Setup requires a valid authenticator code and explicit recovery-code acknowledgment before access. Recovery codes authorize replacement only. Verified passkeys require WebAuthn user verification. Factor management requires fresh operation-bound proof. Session issuance and audit evidence are transactional; replayed codes/challenges, revoked sessions, missing CSRF, untrusted Origins and pre-MFA sessions are denied.

Browsers use HttpOnly host cookies and a session-bound CSRF header. The client clears legacy local/session-storage credentials, performs server verification on restoration and records only non-secret offline sign-out intent. Browser logout revokes the presented session without revoking a later sign-in. Explicit non-browser clients negotiate bearer responses and complete MFA.

Application encryption supports an explicit active key and bounded retained keyring without changing existing file formats. Tests authenticate legacy database envelopes, context-bound MFA secrets and mixed-key files; backup validation rejects reuse of every retained application key. Filesystem rotation defaults to dry run. Immutable PostgreSQL upload/history objects retain their required historical keys; no live ciphertext, key or trigger was changed.

## Automated verification

Tests executed with synthetic data in disposable, network-disabled Docker containers. Source and toolchain were read-only; the environment was explicitly allowlisted; only bounded temporary scratch storage was writable. Containers had CPU, memory, PID, file-size, disk and wall-clock limits. No packages were downloaded or installed, and no production credentials or data were used.

| Check | Observed result |
| --- | --- |
| Frontend Vitest | 201 passed across 41 files |
| Frontend ESLint | Passed |
| Theme and self-hosted fonts | Passed: 87 stylesheets, 144 components/pages, 38 tokens; 6 WOFF2 files |
| Frontend production build | Passed, 514 modules transformed |
| Backend root integration runner | 286 passed, zero failures, one skipped out of 287 |
| Strict MFA/PostgreSQL/HTTP coverage, included above | Twelve checks passed; legacy-fixture exemption explicitly removed |
| Custody-side mixed-key recovery, included above | Actual encrypted PostgreSQL backup/restore verified both key generations; missing historical keys and wrong contexts rejected |
| Separate isolated PostgreSQL TLS fixture | Five checks passed: trusted TLS, untrusted CA, wrong hostname and plaintext rejection |
| Private browser migration exporter | Exact hashes, declared 035 reservation, private-ledger guards, replay, rollback and locking passed |
| Standalone keyring and optional backup fallback regressions | Both witnessed failing before implementation, then five focused operations tests passed |
| Backend unit, syntax and structural governance checks | Passed: 348 unit tests across 37 files; syntax passed; structural references passed (68 tables, 739 columns, nine controls) |

The main runner skips the opt-in PostgreSQL TLS fixture. It was subsequently run separately with an ephemeral synthetic certificate and a TLS-only server in a disposable network-disabled container; all five checks passed. Production transport evidence below is a separate browser observation. The general authorization suites retain an explicit test-mode-only legacy-session fixture option; the strict MFA suite removes it and rejects pre-MFA sessions. Production cannot enable this exemption.

The offline toolchain does **not** exactly match the published dependency lockfiles: available Vitest was 5.0.5, React 19.2.4 and SimpleWebAuthn server 13.3.3, whereas published main requests newer packages. Existing local web-vitals 6.2.3 was mounted read-only for the missing metrics dependency. These runs validate behavior against the available local packages; a clean lockfile CI run remains a release prerequisite. No exact-version validation or new dependency audit is claimed.

An initial broad run exposed old login fixtures that did not negotiate a trusted transport or complete MFA, a fake migration-number fixture that collided with reserved numbering, and an uninitialized disposable base database. These were corrected without relaxing production security. A transient clinical-fixture failure did not reproduce in the targeted API run (16/16) or the full initialized run; a persisted write-consent assertion remains in the test. No clinical access policy was changed.

## Live provider observations

All online access used the owner's Chrome browser. On 17 November 2026:

- Supabase project `medicare` (`ghselatqszqnoteqwyef`, Tokyo) initially had incoming SSL enforcement disabled. After the owner approved the described interruption, the SSL switch and restart confirmation were applied. The final [database settings](https://supabase.com/dashboard/project/ghselatqszqnoteqwyef/database/settings) showed **Enforce SSL on incoming connections checked**.
- The project overview subsequently reported **Healthy**. After Render's normal wake-up page cleared, [the API readiness endpoint](https://medicare-secure-api.onrender.com/readyz) returned `{"success":true}` over HTTPS.
- Before the change, Render's existing API environment showed `DB_SSL=true` and a CA setting. No secret values were copied or changed. Supabase's [SSL documentation](https://supabase.com/docs/guides/platform/ssl-enforcement) describes enforcement across the shared pooler's connections and the restart.
- Supabase's [security statement](https://supabase.com/security) declares AES-256 encryption at rest and TLS in transit. This is provider assurance, not evidence of customer-managed keys, project-specific independent key custody, a verified restore with a new key or regulatory certification. Those owner responsibilities remain pending in the control matrix.

The provider SSL change is live. It does not mean the new MFA/session code is live. No production MFA secrets were enrolled, application keys rotated, archives deleted, network allowlists changed or application deployments triggered.

## Review and preservation

One fresh independent source review covered `a3c5026..50405c4`. It identified eight important findings and no critical findings. The author addressed all eight in one fix pass, with regression failures observed against the reviewed behavior and subsequent passing checks. The reviewer did not rereview the fix pass; completion evidence consists of the covering regressions and the full passing suites above.

| Finding | Fix and evidence |
| --- | --- |
| Last recovery code stranded by a lost recovery/confirmation response | Same-ticket **Resume authenticator setup**; two UI regressions fail on the missing control, then pass without spending a second code |
| Public passkey requests evict protected tickets or exhaust their factor budget | Four-row cap protects proven operations; public options/assertions use a separate bounded budget; strict PostgreSQL flood/recovery regression passes |
| Phone-number passkey login regressed | Email/phone resolution retained and authenticated step-up uses the user ID; signed phone-only login and step-up pass |
| Late logout/401 clears a newer cookie session | Server revocation leaves cookies to expire naturally; serialized same-tab transitions, obsolete-response checks and final cookie-jar regression pass |
| Readable but unwritable storage loses offline logout | Non-secret cookie fallback and persistence probing; reload and total-persistence-failure checks pass |
| Other tabs/profile responses reuse the wrong identity | Non-secret cross-tab signals, verified UI replacement, session-bound requests/responses and identity-only profile updates; reviewed-source regressions fail, corrected tests pass |
| Each passkey phase extends factor freshness | Absolute factor deadline inherited by derived challenges; database expiry comparison passes |
| Mixed-key restore unproved | Separate bounded custody verifier authenticates restored MFA/privacy/upload samples; real archive round trip passes, removed keys and wrong contexts fail |

After the full frontend pass, ESLint required moving cleanup's counter invalidation into a stable callback. The ten affected context tests passed again, followed by ESLint and the production build. No authentication behavior changed in that adjustment.

The retained-cookie fix also required explicit public patient-registration selection. Its regression first returned 401 with a stale cookie instead of reaching the bot-verified public path; the fix preserves mandatory bot verification and all staff session/role checks. The registration/API checks, lint and build passed again, with final suite totals recorded above.

The original checkout remained at `b8e5761f45b2f50043b84f041073cc6ad9cce2f0`; its recorded dirty status matched exactly. All source, index and commit mutations were confined to the isolated checkout. The original staged/unstaged work, deletions and migration 035 were not incorporated or changed.

## Rulings and deferred findings

These decisions were made during execution, in order:

1. Native PowerShell bookkeeping replaces POSIX workspace bookkeeping on Windows. Cost: bookkeeping is manual.
2. Short MFA adapters remain in the route file. Cost: response mapping and routing share a small file.
3. Browser logout revokes the presented session; explicit non-browser logout retains all-session revocation. Cost: other browser devices stay signed in.
4. Migration 035 is explicitly reserved to preserve separately owned work. Cost: integrating it later requires exact-ledger reconciliation before upgrade.
5. Older authorization fixtures retain a test-mode-only legacy-session option; strict MFA tests remove it. Cost: those older fixtures rely on the strict suite for factor-issuance coverage.
6. Logout and rejected requests retain server-revoked cookies until natural expiry, preventing late responses from clearing a new sign-in. Cost: an unusable old credential can remain in the browser until expiry.
7. First enrollment trusts the verified account's current password; loss of every factor and recovery code requires operator identity recovery. Cost: password compromise before first enrollment can claim the initial factor. This is the approved bootstrap policy.
8. Live key custody/rotation, personal enrollment, deployed proxy behavior, production migration and exact lockfile execution remain operator/release checks. Cost: local source review and synthetic tests do not establish production readiness for those boundaries.

Three minor findings are deferred: factor-denial audit metadata currently records HTTP 200 although the response is 401 and the action denotes failure; the public Origin gate does not reject mixed/duplicate credentials as protected authentication does; and the rollout guide needs an explicit first-enrollment bootstrap disclosure (the policy and its cost are recorded above). None was silently treated as fixed.

Subsequent owner instruction authorized fixing these three items and deploying. All three are now addressed in source: denial audits receive the actual 401 outcome, public authentication rejects duplicate/mixed credentials while accepting an absent or stale single session, and the rollout guide explicitly discloses first-enrollment password trust. The two behavior regressions were observed failing before implementation, then the backend suite passed with 349 unit tests and 286 integration checks (one opt-in TLS fixture remains covered by the separate passing fixture above). Deployment and exact-lockfile evidence are tracked in [the activation record](2026-11-17-security-activation.md).
