# Decision Ledger

This ledger records engineering choices that resolve the confirmed product contract. Changing an accepted decision requires updating the affected canonical documents and tests in the same task.

| ID | Status | Decision | Reason |
| --- | --- | --- | --- |
| D-001 | Accepted | IndexedDB through Dexie is the sole primary application database. | Local-first operation, indexed queries, transactions, and explicit browser migrations. |
| D-002 | Accepted | Domain identity uses `crypto.randomUUID()` strings. | Stable portable IDs without IndexedDB ordering; compatible with future sync. |
| D-003 | Accepted | UI → application services → pure engines → repositories → Dexie adapters. | Keeps scheduling and learning rules testable and out of React. |
| D-004 | Accepted | React Router uses hash-based routing for V1. | Reliable direct navigation on GitHub Pages and generic static hosts without rewrite setup. |
| D-005 | Accepted | Date-only values use `YYYY-MM-DD`; instants use UTC ISO strings; display uses `Intl`. | Prevents academic deadlines moving across dates while keeping exact events portable. |
| D-006 | Accepted | FSRS uses `ts-fsrs`; StudyOS does not implement a scheduler formula. | Mature browser-compatible FSRS state transitions and retrievability. |
| D-007 | Accepted | Study Packs use JSON Schema Draft 2020-12 and Ajv 2020 validation. | Portable full schema with mature standards-based validation outside TypeScript. |
| D-008 | Accepted | Study Pack import and full restore are explicit all-or-nothing Dexie transactions. | Partial data is worse than a visible failed operation. |
| D-009 | Accepted | Review, attempt, session, plan-change, import, mastery, and readiness evidence is append-only. | Preserves explainability and long-term history. |
| D-010 | Accepted | V1 backup restore fully replaces data after validation and a safety export. | A deterministic safe restore is smaller and clearer than speculative merge/conflict behavior. |
| D-011 | Accepted | `vite-plugin-pwa` generates the manifest and offline shell; updates must not interrupt active work. | Mature Vite integration with explicit data-safe update UX. |
| D-012 | Accepted | No global store or query cache by default. | IndexedDB, URL state, local state, and focused contexts cover current boundaries. |
| D-013 | Accepted | No telemetry or external academic-data transfer. | Privacy and offline behavior are product constraints, not settings. |
| D-014 | Accepted | Dependencies are installed only when their first vertical slice uses them. | Avoids speculative architecture while preserving the full product target. |
| D-015 | Accepted | Development seed data is opt-in and never populates a real new profile. | Real data begins empty; realistic fixtures remain available for development and tests. |

## Open decisions

| ID | Needed by | Question |
| --- | --- | --- |
| O-001 | Mastery phase | Exact evidence weighting, confidence treatment, and displayed bands. |
| O-002 | Readiness phase | Exact component weights and minimum evidence rules. |
| O-003 | Planner phase | Default block sizes, daily load limits, priority calibration, and prerequisite policy. |
| O-004 | Materials phase | Default stored-blob size threshold and quota UX across target browsers. |
| O-005 | Notes phase | Markdown/math renderer and sanitizer combination after bundle/accessibility review. |
| O-006 | Search phase | Whether indexed normalized fields suffice before adding a token index or worker. |
| O-007 | PWA phase | Update prompt timing around active sessions and unsaved forms. |

Open choices are resolved with tests or measured product needs, not speculative infrastructure.
