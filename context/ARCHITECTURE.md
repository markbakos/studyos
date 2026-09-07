# Architecture

Status: **Accepted design**

Implementation: **Web foundation only**

## Constraints

- Static React application; no required server, account, API, or cloud database.
- IndexedDB is the system of record for user data.
- Core features work offline after the application shell has been cached.
- Desktop and mobile browsers are first-class targets.
- Important logic is deterministic, pure where practical, and testable without React or IndexedDB.
- Data volumes may reach thousands of cards/reviews and years of history; indexed queries and bounded UI reads are required.

## Dependency direction

```text
UI and routes
    ↓
feature application services
    ↓
domain engines
    ↓
repository interfaces
    ↓
Dexie / IndexedDB adapters
```

Dependencies only point downward. Domain engines receive plain typed data and clocks/configuration as inputs. They never import React, Dexie, browser globals, or UI state. React components do not contain scheduling, mastery, readiness, import, or migration rules.

Repositories own persistence queries and transactions, not business policy. Application services coordinate repositories and engines around a use case such as `generatePlan`, `finishStudySession`, or `importStudyPack`.

## Source organization

Create folders only when the first real file needs them:

```text
src/
├── app/                 # bootstrap, routing, providers, shell
├── components/          # genuinely shared UI primitives
├── features/            # vertical product domains
├── db/
│   ├── schema.ts
│   ├── migrations/
│   ├── repositories/
│   └── backup/
├── engine/
│   ├── planner/
│   ├── mastery/
│   ├── readiness/
│   └── spaced-repetition/
├── hooks/               # only cross-feature hooks
├── lib/                 # focused external adapters
└── types/               # truly cross-domain contracts
```

Feature code owns its pages, components, forms, feature services, and feature-specific types. Shared modules cannot import features. Avoid broad barrels and generic `utils`; name modules by responsibility.

## Selected technology

Install each dependency only in the phase that uses it:

- **React Router:** `HashRouter`/hash data router so deep links work on GitHub Pages and other static hosts without rewrite configuration.
- **Dexie:** typed IndexedDB access, explicit `version(n).stores(...)` declarations, and upgrade functions from version 1.
- **Zod:** runtime validation for forms, settings, and internal trust boundaries.
- **Ajv 2020:** the published Draft 2020-12 Study Pack and backup JSON schemas remain portable outside TypeScript.
- **date-fns:** calendar arithmetic around explicit local dates; native `Intl` formats values for display.
- **ts-fsrs:** flashcard state transitions and retrievability; StudyOS stores returned card state and immutable review logs.
- **shadcn/ui:** copy in accessible primitives only when a screen requires them; it is not a blanket component dependency.
- **vite-plugin-pwa:** manifest, Workbox-generated offline shell, static asset precache, and explicit update-ready UI.
- **Zustand:** deferred until shared client-only state cannot remain local or in a focused context.
- **TanStack Query:** not needed for local Dexie data by default; add only for a concrete async cache boundary.

## State ownership

- IndexedDB owns persisted domain state.
- URL owns navigable filters, tabs, selected dates, and shareable screen state.
- Feature components own transient form and interaction state.
- Focused contexts coordinate compound UI subsystems.
- Do not mirror whole database tables into a global store. Query the indexed slice a screen needs and paginate or virtualize measured large collections.

## Persistence and migrations

- Use `crypto.randomUUID()` IDs; never auto-increment domain identity.
- Store instants as UTC ISO strings and date-only academic deadlines as `YYYY-MM-DD` plus optional local time/time zone fields.
- Every schema version remains declared. Index changes go in a new Dexie version; data transforms run in its upgrade transaction.
- Never edit an already-released migration. Never require database deletion to upgrade.
- Multi-table use cases such as Study Pack import, session completion, and restore use one explicit read-write transaction.
- Review, attempt, session, mastery, import, and plan-change history is append-only except narrowly defined correction/removal flows.
- Seed data is an explicit development action and never runs for a production profile.

## Offline and PWA behavior

- The service worker caches versioned application assets, not IndexedDB records.
- The UI remains functional offline and clearly distinguishes optional external material links.
- An available application update is presented to the user; do not reload through an active session or unsaved edit.
- Request `navigator.storage.persist()` from a user-visible storage/backup flow and display the returned status. Explain that even persistent browser storage is not a backup.
- External material references may require reopening. Stored blobs require size/quota disclosure and are included in backup.

## Static deployment

- Vite `base` is deployment-configurable for root hosting and GitHub Pages project paths.
- Hash routing avoids server rewrite and Pages 404 requirements.
- No runtime secret belongs in the browser bundle. External generation runs outside this application and produces a file for import.

## Quality strategy

- Unit-test planner, replanning, date/capacity logic, mastery, readiness, and pack/backup adapters as pure modules.
- Integration-test Dexie migrations and transaction rollback in a real IndexedDB-compatible test environment.
- Keep a small end-to-end suite for the five critical journeys.
- Test PWA install/offline/update behavior against a production build; a Vite build alone is not offline proof.
- Test accessibility with automated checks plus keyboard and screen-reader-oriented manual flows.

## Security and privacy

- Academic data stays local unless the user explicitly exports or opens an external destination.
- No analytics, advertising, hidden telemetry, or third-party data SDKs.
- Treat imported files, Markdown, links, backups, and Study Packs as untrusted input. Validate structure, constrain sizes, sanitize rendered content, and never execute embedded code.
- Object URLs for blobs are revoked after use. File and transaction failures remain visible and recoverable.

## References

- [Dexie versioning and upgrade model](https://dexie.org/docs/API-Reference)
- [Dexie transactions](https://dexie.org/docs/Transaction/Transaction.html)
- [React Router HashRouter](https://reactrouter.com/api/declarative-routers/HashRouter)
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- [Vite PWA guide](https://vite-pwa-org.netlify.app/guide/)
- [Persistent browser storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
