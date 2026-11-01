# Operational assurance and real-use evidence

Application implementation, a published privacy notice and a patient's acknowledgement do not establish that this installation is approved for real patient information. The control matrix intentionally leaves external responsibilities pending. The following is a review procedure, not an assertion that evidence has been supplied.

| Boundary | Responsible reviewer | Required evidence | Recorded state |
| --- | --- | --- | --- |
| Provider storage and locations | Platform/security owner | Actual database, upload, log and backup storage encryption/access/location settings; applicable provider arrangements | Pending owner/provider review |
| Key custody and rotation | Security/recovery owner | Protected independent copies of original application and archive keys; signing-key handling; access/rotation/re-encryption and recovery procedure | Original keys preserved for recorded drills; complete custody/rotation assurance pending |
| Notice/operator facts | Responsible organization and privacy officer | Accurate operator/contact, reviewed processing purposes/basis, recipients, retention, rights/complaint and transfer information; explicit publication authority | No production notice seeded by this feature |
| Scanner operation | Application operator | Reachable ClamAV with current signatures; clean/malicious/unavailable fixture checks | Live scanner unconfigured in latest recorded release; normal uploads fail closed |
| Mail and external notifications | Application/incident owner | Receipt of actual verification/invitation mail; failure/retry records; reviewed recipients and provider retention | Secure SMTP code tested; actual delivery unverified |
| Monitoring and backup failure delivery | Incident owner | A test alert and recovery message to the real receiver; actionable backup failure reporting | Source metrics/rules exist; destination delivery unverified |
| Retention and minimization | Organization/records officer | Approved category/clinic/jurisdiction policies, legal holds, collection necessity, independent disposal ledger and restored-data reconciliation | Tools exist for bounded scope; policy/acceptance remains pending |
| Workforce and credentials | Organization/security owner | Role/access recertification, staff identity/license review, offboarding and privileged access handling | Runtime access controls exist; organizational assurance pending |
| Recovery and availability | Recovery/service owner | Recovery objectives, restored-installation promotion rehearsal, capacity/load and outage tests, free-host availability decision | Two B2/application drills and restart proof recorded; full promotion/availability acceptance pending |
| Optional AI/research | Responsible organization/clinical or study reviewer | Provider/data-use terms, necessity, purpose, disclosure/de-identification limitations and appropriate validation | Aggregate/intake code exists; broad clinical/anonymity assurances are not established |

An evidence record must identify the responsible reviewer, review date, deployment/revision/provider scope, retained artifact and limitations. References in the matrix only establish that a local artifact/scenario exists. If an owner assertion is entered, label it `owner_recorded` with attribution/date/evidence; do not rename it verified or claim an automatic legal decision.

Keep secrets and patient contents outside these tracked documents. They may reference a protected evidence location without embedding credentials, notices to individuals or clinical payloads. A future reviewer should distinguish a plan, a synthetic fixture, a successful actual delivery and a completed provider/organization review.
