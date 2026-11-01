# Encrypted backup archives implementation plan

Goal: archive authenticated encrypted backup bundles in a private Backblaze B2 bucket, retaining seven daily recovery points and three monthly archives.

The user selected B2 and this retention policy. At planning time no B2 account existed; account setup and activation are now complete. Use the existing SHMSBKP1 backup envelope and its separate encryption key; keep existing coordinated-backup requirements. Do not silently substitute the earlier one-off PGP snapshot. Use the documented B2 Native API with Node's built-in fetch, avoiding new dependencies. Reject public buckets, unrestricted credentials, redirects and foreign endpoints. No keys enter source control, command arguments or logs.

- [x] Add a bounded B2 adapter with bucket/prefix-scoped credentials, private bucket verification, paginated version listing, upload, download and exact-version deletion. Test against a synthetic transport, including rejected endpoints, public buckets, wrong scope and pagination.
- [x] Add archive orchestration: authenticate a private staged copy before network access, upload daily and monthly copies, download and compare ciphertext before pruning. Retain one latest copy per day/month and the newest seven days/three months; never prune other names. Abort pruning after any failure. Enforce an 8 GB prefix budget including old versions and prospective uploads. Test corruption, failed verification, budget overflow and retention boundaries.
- [x] Add operator commands and setup/recovery documentation. Coordinated database-plus-file backups retain actual write-quiescence requirements. The subsequent scheduled-backup plan added an explicit consistent snapshot mode for the verified fileless demo and completed scoped credential setup without claiming writes were stopped.
- [x] Run syntax, full backend unit and backup/archive integration checks; commit coherent changes separately and record actual results.

Final activation and fresh cloud/application recovery are recorded in the [scheduled backup release](../../releases/2026-11-01-scheduled-backup-release.md).

Review focus: B2 retains versions, so deletion must target file IDs; retry versions count toward budget. Daily/monthly grouping uses UTC. Unknown names and future-dated entries cannot become retention anchors. Local artifact tampering and remote download corruption must prevent pruning. Provider error bodies must not expose credentials.
