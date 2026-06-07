# Security Specification for Diesel Generator Billing App

## 1. Data Invariants
- A user can only access their own backup document.
- Backup contains the serialized `AppDatabase` representing company parameters, clients, gensets, prices, and monthly site logs.
- Timestamps must be validated using server-provided timestamps (`request.time`).
- Users must be authenticated to read or write.

## 2. The Dirty Dozen Payloads (Targeting users/{userId}/backups/active)
1. Write to target user `userA`'s backup while authenticated as `userB` (Identity Violation) -> DENIED.
2. Read target user `userA`'s backup while authenticated as `userB` (Identity Violation) -> DENIED.
3. Read or write to backup while unauthenticated (Auth Violation) -> DENIED.
4. Write with an extremely large size backup to cause billing exhaustion -> DENIED.
5. Spoof identity fields like `userId`.
6. Write with arbitrary unverified email if standard checks apply.
7. Attempt shadow fields inside the schema.
8. Skip timestamp validation with a client-supplied date.
9. Inject malicious shell scripts or invalid IDs.
10. Attempt deleting the backup document as a guest.
11. Bypassing the security rules using blanket query operations.
12. Attempt updating other collections or wildcard endpoints -> DENIED.
