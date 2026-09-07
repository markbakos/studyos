# StudyOS Context

This directory is the durable product and engineering authority for StudyOS. Read it before substantial work and keep it aligned with implemented behavior.

## Current state

- Product target: a production-usable, local-first personal study operating system.
- Implementation: the working tree contains an initial IndexedDB schema, academic and learning screens/services, planner, portability runtime, and PWA configuration. These are not completed release gates.
- Active delivery phase: close Foundation validation gaps while completing and testing the existing vertical slices.
- Planner policy 1.1 spreads exam-topic blocks across available days and falls back to compact scheduling when spacing increases shortfall. See [`PLANNER.md`](PLANNER.md) for limits.

Do not infer implementation from a documented design. [`VALIDATION.md`](VALIDATION.md) records actual evidence.

## Reading order

1. [`PRODUCT.md`](PRODUCT.md) — vision, principles, V1 scope, UX, and definition of done.
2. [`ARCHITECTURE.md`](ARCHITECTURE.md) — system boundaries and technical decisions.
3. [`DATA_MODEL.md`](DATA_MODEL.md) — entities, relationships, indexes, and migration rules.
4. [`PLANNER.md`](PLANNER.md) — deterministic planning and replanning contract.
5. [`STUDY_PACK.md`](STUDY_PACK.md) — portable content format and transactional import.
6. [`BACKUP_FORMAT.md`](BACKUP_FORMAT.md) — full-data backup and safe restore.
7. [`ROADMAP.md`](ROADMAP.md) — dependency-ordered delivery plan and phase gates.
8. [`DECISIONS.md`](DECISIONS.md) — accepted implementation decisions and open choices.
9. [`VALIDATION.md`](VALIDATION.md) — acceptance evidence and remaining gates.

## Status language

- **Confirmed** — explicitly required by the product handoff.
- **Accepted** — engineering choice selected to satisfy confirmed requirements.
- **Open** — unresolved and must be decided before affected implementation.
- **Deferred** — intentionally outside the current delivery phase.
- **Implemented** — present in the repository but not necessarily validated.
- **Validated** — supported by recorded automated or manual evidence.

## Authority and maintenance

Current user instructions override this context. When a decision changes, update the relevant canonical document, [`DECISIONS.md`](DECISIONS.md), and affected acceptance gates in the same commit.

Keep requirements in one canonical place and link to them elsewhere. Examples illustrate behavior unless labeled as exact contracts. Never mark a feature complete from pages, types, or builds alone; validate its user journey and data behavior.
