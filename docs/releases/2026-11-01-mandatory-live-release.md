# Mandatory requirements: live release verification

Verified on 2026-11-01 using synthetic demonstration accounts and data.

## Integration and deployment

- Application source merged into `main` in [PR 2](https://github.com/vTg2208/medicare-secure/pull/2), followed by [patient inbox navigation, PR 3](https://github.com/vTg2208/medicare-secure/pull/3) and [private runtime permissions, PR 4](https://github.com/vTg2208/medicare-secure/pull/4).
- Verified application commit: `c232e6251e1cfd60fe2c8f19bfbd40b0f58fcc02`.
- Production frontend: <https://medicare-vtg.vercel.app>. [Vercel deployment](https://vercel.com/theegela-vishnu-vardhans-projects/medicare/DuBJuFGPwi9Ej2kMKUy8bKNomQxg) succeeded for this commit.
- Production API: <https://medicare-secure-api.onrender.com>. [Render deployment](https://dashboard.render.com/web/srv-dbj30sg473hc73b1iu00/deploys/dep-dbjfr9rm8hqs73fnvjd0) is Live for this commit. Automatic deployment on commit was restored after the initial manual deployment.
- Both the direct API readiness endpoint and frontend readiness proxy returned HTTP 200 with `success: true`.
- Hosted private schema upgraded from migration 025 to 031. Existing migration checksums were preserved. Anonymous and ordinary authenticated Data API access to the private schema remains denied.

The release documentation commit follows the application commit and does not change application behavior.

## Live workflow evidence

| Workflow | Observed result |
| --- | --- |
| Nurse profile | Edited contact fields in the live UI, saved, and reloaded. An independent API read confirmed persistence. Original empty contact fields were restored. A patient attempting the nurse update was denied. |
| Messaging | Patient followed the dashboard Messages link into the persisted inbox and sent a synthetic message. The clinician read it and replied through the live UI. A subsequent patient session and subject export both contained that reply. Another patient could not access the thread. Database checks confirmed message bodies were ciphertext. |
| Availability and booking | An administrator published a calendar; an ordinary patient could not configure it. Real clinic-time slots appeared in the UI. Selecting 4:00 PM Asia/Kolkata saved exactly 10:30 UTC. Separate simultaneous API bookings for the same slot returned 201 and 409. Cancellation released each test reservation. |
| Processing restriction | Officer fulfillment enforced actual denial of messaging for both patient and clinician requests. A different patient could not release the restriction. The owner could release it, restoring access subject to existing consent and care authorization. |
| Clinical correction | Officer review appended an attributed, encrypted synthetic addendum visible to the patient and included in the subject export. The original clinical record was retained. |
| Research objection | The officer fulfilled the objection in the live UI, with decision history and applied research restriction visible. The patient saw and released that restriction in the live Privacy Center. The release success notice appeared. |
| Final state | All three verification privacy requests are fulfilled. No active processing controls remain. Both temporary bookings are cancelled and their slots released. Test sessions were signed out. |

The fictional demonstration clinic now has an explicit daily 09:00–18:00 Asia/Kolkata calendar with 30-minute slots. Availability depends on this published configuration and actual reservations. Current-day selection was exercised in the browser; next-day availability and concurrency were exercised through the deployed API. Native browser date-control automation did not reliably commit a changed date, so that specific date-change interaction is not claimed as verified.

Live verification found two issues and resolved both before completion: the patient dashboard still linked Messages to a placeholder, and the existing private runtime database role lacked the narrowly scoped column permission needed by thread upsert/locking. Regression coverage now exercises the rendered navigation and the exact deployment grant script. Message UPDATE/DELETE permissions remain denied to the runtime role.

## Tests and release checks

- Backend unit tests: **161 passed** across 24 files.
- Hosted PostgreSQL integration discovery: **182 passed, zero failed, one dedicated TLS suite skipped**. [Main backend CI](https://github.com/vTg2208/medicare-secure/actions/runs/41290621963) passed, including migration, backup/restore, dependency and production image checks with PostgreSQL 18.
- Dedicated offline PostgreSQL TLS fixture: **5 passed**, covering trusted TLS and refusal of plaintext, wrong-hostname and untrusted certificates.
- Frontend: **99 behavior tests passed**, with strict lint, theme checks, dependency checks and production build passing. [Frontend change CI](https://github.com/vTg2208/medicare-secure/actions/runs/41289950694).
- The new private runtime regression first failed with SQLSTATE 42501 before the grant fix; the targeted runtime and messaging suites then passed all **8 checks**.
- Hosted CI exposed a nonportable fixture directory. The helper now creates and cleans its own temporary directory under the operating system temporary directory; the corrected CI run passed.

## Recovery and retained evidence

Before migration, all 47 private schema tables and the 25-entry migration ledger were captured in an encrypted local snapshot. Authenticated decryption and typed reconstruction checks matched the original payload. The encrypted artifact, separate recovery key and verification manifest are retained under the ignored `.local/release-mandatory` directory. They are not committed or published. This logical snapshot is not a full host recovery drill.

Local evidence also includes `final-live-checks.json`, `ui-booking-cleanup.json`, CI logs, and the officer-review and patient-release screenshots. The synthetic messages, fulfilled review histories and clearly technical clinical addendum remain as audit evidence. No real-patient disposal or outbound notification was performed.

Before real patient use, the organization still needs approved retention rules, workforce/access review, verified storage encryption and key custody, external incident delivery, coordinated off-host backup recovery exercises and stakeholder acceptance. Deployment and these tests do not constitute regulatory certification.
