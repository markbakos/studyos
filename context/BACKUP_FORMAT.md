# Backup and Restore Format

Status: **Accepted V1 design**

Implementation: **Not started**

## Purpose

Backup is the safety boundary for a local-only application. It preserves all user-owned state required to recover another browser profile without a server.

Study Pack export moves learning content. Full backup preserves the application.

## V1 container

- Suggested suffix: `.studyos`
- UTF-8 JSON for inspectability and portability
- Top-level `backupFormatVersion: 1`
- Includes the logical application data schema version and app version
- Includes a SHA-256 digest of the canonical payload to detect accidental corruption
- Stored material blobs are encoded with MIME type, byte length, and base64 content

```json
{
  "backupFormatVersion": 1,
  "appVersion": "0.0.0",
  "dataVersion": 1,
  "exportedAt": "2026-09-07T12:00:00.000Z",
  "source": { "app": "StudyOS" },
  "counts": {},
  "payload": { "tables": {} },
  "digest": { "algorithm": "SHA-256", "value": "..." }
}
```

The eventual machine schema lives beside backup code and is versioned independently from Dexie migrations.

## Included data

All domain tables are included: subjects, topics, materials and stored blobs, notes, exams and topic weights, assignments/subtasks, calendar events, availability, plans/tasks/changes, sessions/items, cards/reviews, questions/attempts, mastery/readiness snapshots, Study Pack/import records, settings, and application metadata.

Excluded data:

- service-worker and HTTP caches;
- transient UI state, open dialogs, and active object URLs;
- generated search indexes that can be rebuilt;
- development seed controls;
- telemetry, because StudyOS has none.

An active study session is included and can be recovered as paused after restore.

## Export workflow

1. Read a consistent snapshot of all included tables in a Dexie read transaction.
2. Convert dates/blobs and other non-JSON values through explicit codecs.
3. Validate the payload against the current backup schema.
4. Serialize canonically, calculate SHA-256 with Web Crypto, and assemble the envelope.
5. Create the download with a date-based name such as `studyos-backup-2026-09-07.studyos`.
6. Update last-successful-backup only after the browser has created the download artifact.

Show estimated file size and stored-material contribution before large exports.

## Restore workflow

V1 restore is full replacement, not a merge.

1. Read and size-check the file without modifying IndexedDB.
2. Parse the envelope and validate its schema, supported format version, declared counts, and digest.
3. Run pure backup-format migrations in memory to the current logical payload version.
4. Validate all entity references and invariants.
5. Show source date/version, counts, warnings, and the explicit replacement consequence.
6. Require the user to download a fresh safety backup of current data before enabling destructive confirmation, unless the current database is empty.
7. In one read-write transaction, clear included tables, write restored records, and update restore metadata.
8. Rebuild derived indexes/snapshots where specified, reopen queries, and verify expected counts.

Any failure before commit leaves current data untouched. Any transaction error aborts replacement and presents a recoverable error. Never clear the database first and import later.

## Compatibility and migrations

- Backup format migrations are pure functions from one payload version to the next.
- Dexie schema migrations upgrade the installed database structure; they are related but separate.
- Keep fixtures for every released backup version and prove restore into the current application.
- Reject future unsupported versions without attempting partial restore.
- Preserve unknown extension metadata only where its schema explicitly allows it.

## Security and privacy

- A backup contains private academic data. State this before download and restore.
- V1 backups are not encrypted; never imply otherwise. Platform password managers or encrypted disk/storage remain the user's responsibility.
- Imported Markdown, URLs, filenames, and blobs remain untrusted after restore and receive the same validation/sanitization as manually imported data.
- The digest detects corruption, not malicious tampering or authenticity.

## Reminders and storage status

- Settings may remind the user on app open every configured number of days, default off until chosen.
- Display last successful backup and whether `navigator.storage.persisted()` reports persistent storage.
- Request persistence only in a user-visible data-safety flow. A granted response reduces eviction risk but does not replace backups or synchronize devices.

## Acceptance gate

Use a populated fixture spanning every table and stored blob: export, clear a disposable browser profile, restore, and compare logical data and relationships. Also prove invalid schema, bad digest, unsupported version, quota failure, and injected transaction failure preserve the existing database.
