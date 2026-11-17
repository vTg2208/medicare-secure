# Security activation — 17 November 2026

Owner instruction: fix the three deferred issues, finish remaining checks, then push and deploy through Chrome while preserving existing local changes.

## Source and regression evidence

- Factor-denial audit evidence now records HTTP 401. The database regression failed with 200 before the change and passes after it; session-success audit behavior remains unchanged.
- The public authentication Origin gate validates credential interpretation before proceeding. Duplicate session/CSRF cookies and mixed cookie/bearer input fail; requests without an existing session and requests with one stale cookie still reach the normal public flow. The new unit regression failed before the change and passes after it.
- The coordinated rollout guide explicitly states that the verified current password can claim the first authenticator, including the pre-enrollment password-compromise risk and operator recovery boundary.
- Local constrained offline verification: 349 backend unit tests, 286 root integration checks, syntax and structural governance passed. The prior full frontend suite (201 tests), lint/build, mixed-key restore and separate TLS fixture remain recorded in [implementation evidence](2026-11-17-mfa-session-encryption.md). This follow-up changes backend behavior and documentation only.

## Release gates

The remote release branch is created from the actual published main `9eba84477752173e2143c92998269e2a64014031`, preserving real repository ancestry. Only the reviewed feature files are transferred; the synthetic local baseline and the original checkout's dirty changes are excluded.

Clean locked-dependency CI, dependency audits, hosted frontend build, protected recovery snapshot, coordinated private-schema upgrade/API/UI activation and live HTTPS/cookie/MFA checks must be observed before this record reports successful activation. These gates are pending while this preparation record is written; no live application activation is claimed here.
