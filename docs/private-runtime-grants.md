# Private hosted runtime grants

After guarded migrations 026–031, apply `backend/scripts/private-runtime-grants.sql` as the existing private-schema owner for the existing `healthcare_api` principal. The script creates no role, changes no password and exposes no schema. It adds access only to the new feature tables and message sequence. Existing schema/audit protections must remain in place.

Conversation creation uses an upsert, and sending locks the thread row. PostgreSQL requires UPDATE permission for that contract, even though message bodies remain append-only. Only `UPDATE(patient_id)` is granted on thread metadata; broad thread updates and message update/delete permissions are not added. The API still checks subject ownership, current consent and care scope on every operation.

A real PostgreSQL role regression applies this exact grant script in a disposable schema, creates/reopens a conversation, locks its row, and proves that provider reassignment and message rewriting/deletion stay denied. It failed with 42501 before the column grant and passes afterward. This closes the permission gap exposed by the live restricted role; owner-level API fixtures alone could not reveal it.
