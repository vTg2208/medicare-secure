# Security activation — 17 November 2026

Owner instruction: fix the three deferred issues, finish remaining checks, then push and deploy through Chrome while preserving existing local changes.

## Source and regression evidence

- Factor-denial audit evidence now records HTTP 401. The database regression failed with 200 before the change and passes after it; session-success audit behavior remains unchanged.
- The public authentication Origin gate validates credential interpretation before proceeding. Duplicate session/CSRF cookies and mixed cookie/bearer input fail; requests without an existing session and requests with one stale cookie still reach the normal public flow. The new unit regression failed before the change and passes after it.
- The coordinated rollout guide explicitly states that the verified current password can claim the first authenticator, including the pre-enrollment password-compromise risk and operator recovery boundary.
- Local constrained offline verification: 349 backend unit tests, 286 root integration checks, syntax and structural governance passed. The prior full frontend suite (201 tests), lint/build, mixed-key restore and separate TLS fixture remain recorded in [implementation evidence](2026-11-17-mfa-session-encryption.md). This follow-up changes backend behavior and documentation only.

## Release gates

The remote release branch is created from the actual published main `9eba84477752173e2143c92998269e2a64014031`, preserving real repository ancestry. Only the reviewed feature files are transferred; the synthetic local baseline and the original checkout's dirty changes are excluded.

## Activated source and locked checks

[PR 40](https://github.com/vTg2208/medicare-secure/pull/40) was squash-merged as `2f951cf01c7595ac972a375227c3606481930215`. All six pull-request checks passed before maintenance. The same source passed every post-merge check:

- [Backend CI](https://github.com/vTg2208/medicare-secure/actions/runs/44008583010): locked install, syntax, governance, unit tests, dependency audit, actual PostgreSQL integration, repeatable migrations and production image.
- [Frontend CI](https://github.com/vTg2208/medicare-secure/actions/runs/44008582982): locked install, lint, tests, production build, dependency audit and nginx container/header/routing smoke tests.
- [Container-client backup recovery](https://github.com/vTg2208/medicare-secure/actions/runs/44008583029): actual dump, encrypted archive, snapshot, durable upload and restore paths.

CI exposed fixture differences hidden by the offline environment: missing disposable database passwords, initialization of synthetic recovery keys after startup configuration, and unrelated subtests sharing the HTTP login-failure budget. The fixes supply fixture credentials before initialization and isolate fixture budgets. The strict suite removes legacy-session acceptance; production MFA enforcement and rate limits are unchanged. Local follow-up verification passed all 59 backup-path checks and all strict MFA/mixed-key recovery checks.

## Coordinated production activation

1. A fresh [protected encrypted snapshot and cloud recovery drill](https://github.com/vTg2208/medicare-secure/actions/runs/44006695641) succeeded before migration. Existing application and backup keys were retained; no live keys were created, disclosed or rotated.
2. Render was suspended and visibly confirmed suspended before migration. A temporary session-write gate also removed INSERT/UPDATE/DELETE from the existing API role, with all three effective privileges verified false. This kept authentication closed while the hosting service resumed and built the replacement.
3. The guarded private-schema browser upgrade verified the exact 001–034 ledger and applied only `036_mfa_sessions`. Its recorded SHA-256 is `050b3dfd4dcc8d881f78d6542eca5713e6d2b74c59b83b4758a8e1f029d0899f`. The final ledger contains 35 entries, all existing sessions were inactive, and reserved prefix 035 was untouched. The three new auth tables have zero PUBLIC/anon/authenticated grants; existing API data privileges and backup SELECT were verified.
4. [Render deployment](https://dashboard.render.com/web/srv-dbj30sg473hc73b1iu00/deploys/dep-dbtscuqfngtc73a3aecg) reported **Deploy succeeded | Live** for source `2f951cf`, with successful startup and background-job initialization.
5. [Vercel production deployment](https://vercel.com/theegela-vishnu-vardhans-projects/medicare/Aom4DHe3NH3vNjXh8vVkUmdef8pS) reported **Ready, Production, Current** for the same source, with `medicare-vtg.vercel.app` assigned.
6. Only after the new API was live were the exact prior session-write privileges restored. All three were verified true. The temporary gate produced an expected denied auto-logout attempt during maintenance; it was removed before normal access resumed.

## Transport and remaining live verification

- Chrome navigation to both HTTP app/API URLs resolved to HTTPS. The public API `/readyz` returned `{"success":true}` after deployment, and the sign-in screen rendered with the existing theme.
- Supabase's **Enforce SSL on incoming connections** switch remained checked. Both observed active `healthcare_api` database connections used TLS (`pg_stat_ssl`, two connections, all SSL true).
- The [post-activation protected backup and cloud recovery drill](https://github.com/vTg2208/medicare-secure/actions/runs/44009167034) succeeded against the upgraded schema.
- Credential creation is owner-operated. The owner explicitly deferred personal sign-in and authenticator enrollment until later. Live account enrollment/passkey interaction and browser-cookie inspection remain deferred; no live factor success is claimed here. The committed automated suites cover enrollment, recovery, verified passkeys, replay denial, cookie attributes, CSRF and revocation with synthetic fixtures.

The isolated worktree is the only checkout changed. The original checkout's HEAD and complete dirty status were preserved; its separately owned migration 035 and other uncommitted work were not published.
