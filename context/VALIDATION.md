# Validation Ledger

This file records what has actually been proven. Design documents describe targets, not completion.

## Current evidence

| Area | Status | Evidence |
| --- | --- | --- |
| React/Vite/TypeScript/Tailwind foundation | Validated | `npm run check` passed on 2026-09-08: Oxlint, TypeScript project build, and Vite production build. Two existing lint warnings remain in `Shell.tsx` (render-time clock) and `SubjectsPage.tsx` (Fast Refresh export). |
| Context documentation | Validated | 2026-09-08: context Markdown relative links, balanced fences, final newlines, and trailing whitespace checked; `git diff --check` passed. |
| Browser rendering | Not validated | No browser or visual check recorded. |
| Responsive/mobile UX | Implemented, not browser validated | Responsive shell and feature screens exist in the working tree; no viewport interaction evidence recorded. |
| IndexedDB and migrations | Partial automated runtime evidence | 2026-09-08: Node 26.8.1 with fake-indexeddb verifies V1 initialization and reopen. No historical version upgrade or real-browser migration evidence. |
| PWA/install/offline | Configured, not browser validated | Production build generates a manifest and service worker; installation, offline operation, and safe updates remain open. |
| Domain services | Partial automated runtime evidence | 2026-09-08: all 14 existing tests in `tests/domain.test.ts` pass, covering planning, hierarchy, learning, sessions, pack/backup validation, and injected transaction rollback. The backup fixture does not contain stored blobs despite its test title. |
| Planner spacing and content changes | Automated runtime | 2026-09-08: all five tests in `tests/planner.test.ts` pass: daily revisits/determinism/immutability, same-day and unavailable future dates, assignment contention fallback, prerequisites/exact impossible demand, and question-driven replanning/idempotency. |
| Product journeys A–E | Not browser validated | Initial services and screens exist, but end-to-end user journeys remain open. |

Runtime commands: `node --import tsx tests/domain.test.ts` and `node --import tsx tests/planner.test.ts`. The `npm test` CLI was blocked by sandbox IPC permissions (`listen EPERM`); direct Node execution uses the installed tsx loader and runs all 19 named tests without the CLI socket.

## Evidence labels

- **Static:** lint, type checks, schema checks, and source-level assertions.
- **Automated runtime:** unit, integration, or E2E execution with the environment named.
- **Browser:** interaction verified in a named browser/build mode.
- **Mobile viewport:** responsive browser evidence; not native-device evidence.
- **Deployment:** behavior verified at the named static host URL.
- **Recovery:** exported data restored into a disposable profile and compared.

Never promote one label into another. In particular, a production build does not prove PWA installation, offline behavior, visual quality, accessibility, deployment routing, or data recovery.

## Documentation checks

Before committing context changes:

- every relative Markdown link resolves;
- Markdown fences are balanced;
- files end with a newline and have no unintended trailing whitespace;
- required canonical files exist;
- current status matches the repository;
- architecture, model, planner, pack, backup, and roadmap terminology agree;
- `git diff --check` passes for files changed by the task.

## Future release gates

### Data safety

- Fresh database and every released Dexie version migrate to current.
- Study Pack import and restore abort cleanly on injected failure.
- Full backup/restore comparison covers every persisted table and stored blob.
- Quota, corrupt input, future-version input, and persistence denial have clear recovery UX.

### Deterministic engines

- Planner scenario and invariant tests pass with frozen time/configuration.
- Identical planner input is idempotent.
- FSRS scheduling matches pinned library behavior.
- Mastery/readiness fixtures expose components and low-confidence behavior.

### User journeys

- Journey A: organize → plan → Today.
- Journey B: Today → session → learning evidence → updated progress.
- Journey C: missed work → transparent feasible/infeasible replan.
- Journey D: validate/preview/import → immediately usable content.
- Journey E: export → clear disposable profile → restore exact logical data.

### Delivery environments

- Local production preview.
- GitHub Pages project deployment including direct/hash route reload.
- Another static host where configured.
- Supported desktop browsers.
- Mobile browser viewports and at least one real mobile-browser installation check.
- First-load online followed by full core workflow offline.

### Accessibility and privacy

- Keyboard navigation and visible focus across primary journeys.
- Automated accessibility scan plus manual semantics/dialog/form review.
- Light/dark contrast and non-color state cues.
- Network inspection confirms no academic data or telemetry leaves by default.
