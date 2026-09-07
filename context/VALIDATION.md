# Validation Ledger

This file records what has actually been proven. Design documents describe targets, not completion.

## Current evidence

| Area | Status | Evidence |
| --- | --- | --- |
| React/Vite/TypeScript/Tailwind foundation | Validated | `npm run check` passed on 2026-09-07: Oxlint, TypeScript project build, and Vite production build. |
| Context documentation | Validated | 2026-09-07: 11 Markdown files checked, all relative links resolved, 10 required context files present, fences balanced, final newlines present, and `git diff --check` passed. |
| Browser rendering | Not validated | No browser or visual check recorded. |
| Responsive/mobile UX | Not implemented | Placeholder screen only. |
| IndexedDB and migrations | Not implemented | No Dexie dependency or schema. |
| PWA/install/offline | Not implemented | No manifest or service worker. |
| Product journeys A–E | Not implemented | Product subsystems do not exist. |

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
