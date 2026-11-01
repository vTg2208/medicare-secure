# Mandatory requirements implementation plan

**Goal:** Complete the assessed application gaps in independently tested commits, preserving existing workspace changes.

**Architecture:** Keep React, Express and PostgreSQL. Enforce patient ownership, current consent and care scope on the server. Store sensitive new narratives using existing context-bound encryption. Add ordered migrations; never modify checksummed migrations or operate on real patient data during verification.

**Execution:** Implement sequentially in this chat. Commit reviewed changes to `feat/healthcare-mandatory-requirements` in the isolated `.local/mandatory-implementation` checkout, synchronizing the same files into the original workspace. No deployment, outbound patient messages, or live data disposal.

## Tasks and acceptance checks

- [x] Nurse profile: reproduce the missing transaction import through the actual HTTP route; verify saved account/profile fields and rollback on a failing profile write; fix and commit.
- [x] Messaging: persist encrypted patient/care-provider messages; require current consent and assigned care for both reads and sends; provide patient and provider inboxes with empty/error states. Test ownership, spoofing, revocation, audit failure and rendered send/reply behavior; commit.
- [x] Appointment availability: use explicitly configured recurring doctor hours, organization time zones and stored reservations; preserve the selected instant in requests; serialize booking/rescheduling and release cancelled slots. Test empty calendars, invalid dates, cross-organization doctors and concurrent double booking plus rendered selection; commit.
- [x] Privacy fulfillment: implement purpose-specific restrictions and objections and auditable correction/addendum actions, with officer decisions linked to actual effects. Test authorization, ongoing denial, exception boundaries and transaction rollback; commit.
- [x] Retention: implement explicit jurisdiction/record-category policies, holds and reviewed disposal eligibility. Keep disposal disabled unless a policy and authorized decision exist. Verify protection of unexpired/held records and retained audit evidence; commit.
- [ ] Deployment safeguards: add verifiable configuration/readiness checks, operational delivery/recovery procedures and safe tests. Clearly distinguish implemented tooling from owner-supplied provider agreements, keys, alert receivers and real-host recovery evidence; commit.
- [ ] Finish: stabilize timing-sensitive UI verification, run backend unit/real database suites, frontend behavior/lint/build checks, and review requirement evidence. Record remaining external obligations without claiming legal certification.

## Review focus

Consent can be revoked between viewing and acting; authorization must be checked on every request. Concurrent booking and rescheduling must not overwrite another patient's reservation. Message bodies must not enter logs/audits. Restriction and disposal decisions must not be mere case-status changes. Existing visits/files/clinical evidence must survive migrations. Each task uses failing regression tests before implementation and records commands/results below.

## Progress

Baseline: current application files involved in the first tasks match clean release commit d931360. Existing source workspace has extensive earlier uncommitted changes; they are not included in new feature commits. Prior assessment ran 156 backend and 98 frontend cases, with timing-sensitive UI reruns.

Nurse: e4ef20b; regression RED → GREEN; 28 actual HTTP/PostgreSQL cases and 156 backend unit cases passed.
Messaging: 35 HTTP/PostgreSQL cases (existing access + new messaging), 156 backend unit cases, 102 frontend cases, strict frontend lint, theme check and production build passed. Sensitive bodies are context-encrypted and included in the subject export; no external messages were sent.

Appointments: 6 appointment cases and existing access/private-schema upgrade checks passed (51 database cases across runs), 156 backend unit cases, 106 frontend cases, strict lint, theme check and production build passed. Older browser tests now discover the current migration chain instead of fixing its length at 25. No hosted migration was run.

Privacy fulfillment: restriction/objection and clinical/demographic correction regressions RED → GREEN; 8 fulfillment cases plus existing privacy/access/messaging suites passed, 156 backend units, 108 frontend cases, strict lint and production build passed. Patients retain access; emergency read exceptions remain audited; no live decisions were applied.

Retention: nine disposal/governance cases plus privacy and fresh/upgrade installation checks passed (44 database cases), 156 units, 109 frontend cases, strict lint, theme and production build passed. A failing wrong-mount cleanup regression now rejects unavailable attachment directories and leaves work pending. Only synthetic disposable fixtures were removed.
