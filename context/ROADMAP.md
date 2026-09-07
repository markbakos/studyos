# Delivery Roadmap

Status: **Confirmed sequence with accepted phase gates**

StudyOS is delivered as connected vertical slices. Each subsystem defines its domain model, pure logic, tests, persistence, UI, workflow validation, and documentation before the next broad layer depends on it. Do not create empty feature folders in advance.

## Current baseline

- React, TypeScript, Vite, Tailwind, and Oxlint are configured.
- The working tree contains an initial application shell, domain screens/services, IndexedDB V1, planner, learning engines, portability, and PWA configuration; the production build passes.
- Product and engineering context is established.
- Initial implementations span the delivery phases, but no phase exit gate has been fully validated. Continue connected slices and record evidence rather than treating existing screens as completion.
- Planner 1.1 now adds topic revisits across available days with a deadline-capacity fallback and practice-content cache invalidation. Runtime regression evidence is in [`VALIDATION.md`](VALIDATION.md).

## Phase 1 — Foundation

Deliver:

- responsive application shell and hash routing;
- only the shadcn/ui primitives required by the first screens;
- typed Dexie database version 1, repositories, and migration harness;
- settings, theme, locale/week-start defaults, and storage persistence status;
- backup envelope/schema foundation with empty-database export/restore;
- PWA manifest, icons, offline shell, and safe update notification;
- test harnesses for pure modules, IndexedDB integration, and critical browser flows.

Exit gate: a fresh profile starts offline after first load, settings persist, database V1 migrates in tests, an empty backup round-trips, responsive shell works by keyboard on desktop/mobile viewports, and production PWA behavior is manually verified.

## Phase 2 — Academic organization

Deliver connected slices in dependency order:

1. Subjects with archive and useful empty-state onboarding.
2. Hierarchical topics with cycle protection and stable ordering.
3. Exams with topic coverage/weights.
4. Assignments and subtasks.
5. Weekly availability and date exceptions.
6. Study-focused Today/week/month/term calendar projections.
7. Lightweight notes and material references/storage choices.

Exit gate: Journey A can enter all planning inputs; repository queries remain bounded; schema upgrades from Phase 1 preserve fixtures; mobile CRUD, keyboard access, backup, and restore cover all new entities.

## Phase 3 — Planner and Today

Deliver:

- pure capacity and deadline normalization;
- obligation estimation and versioned planner policy;
- deterministic task generation, spacing/interleaving, feasibility, and explanations;
- transactional plan persistence and append-only plan changes;
- action-first Today dashboard;
- missed-day and changed-input replanning.

Exit gate: planner scenario/invariant tests pass, Journey A generates a realistic plan, Journey C redistributes missed work without overdue accumulation, impossible schedules expose exact shortfall, and the UI explains changes.

## Phase 4 — Learning engine

Deliver:

- guided study sessions and recoverable lightweight timer;
- flashcard authoring and `ts-fsrs` scheduling;
- due-review flow with Again/Hard/Good/Easy and immutable logs;
- practice question authoring, type-specific answering/grading, and immutable attempts;
- retrieval-practice and appropriate interleaving session composition.

Exit gate: Journey B works end to end, a reload safely resumes an active session, due-card scheduling matches library fixtures, and planner demand updates from real outcomes.

## Phase 5 — Learning signals

Deliver:

- transparent topic mastery with confidence/evidence breakdown;
- StudyOS exam readiness with coverage, recall, practice, recency, remaining work, and weakest topics;
- weak-topic detection and restrained progress analytics;
- explanations linking recommendations to learning evidence.

Exit gate: versioned pure engine tests pass, signals update after Journey B, low-evidence states avoid false confidence, and history answers why a topic is weak.

## Phase 6 — Study Packs

Deliver:

- Draft 2020-12 `study-pack.schema.json` and valid/invalid fixtures;
- bounded parser plus structural and semantic validation;
- preview, target-subject mapping, and explicit duplicate choices;
- transactional import and immutable import history;
- subject/topic selection export and round-trip tests.

Exit gate: Journey D passes, adversarial packs fail safely, transaction injection proves rollback, and imported learning content works immediately in search and planning.

## Phase 7 — External generator

Deliver:

- `study-generator/SKILL.md` provider-neutral workflow;
- canonical schema copy/reference, README, prompts, and validated examples;
- source-grounding and reference requirements;
- Codex-compatible structured-output instructions without browser coupling;
- topic-only research workflow that records credible references.

Exit gate: a source-based pack and a topic-only pack both validate and complete Journey D. No browser bundle contains model credentials or generator code.

## Phase 8 — Production polish

Deliver:

- global `Ctrl+K` search across all required entities;
- mobile-specific Today/Study/navigation polish;
- backup reminders, storage/quota warnings, and material-size UX;
- dark/light themes, empty states, accessibility, keyboard shortcuts, and performance work;
- optional realistic semester seed command for development;
- full migration matrix, backup recovery, critical E2E suite, and static-host deployment checks.

Exit gate: all five critical journeys and the complete product definition of done in [`PRODUCT.md`](PRODUCT.md) are validated on fresh desktop and mobile browser profiles, online and offline where applicable.

## Cross-phase rules

- Data migration and backup coverage ship with every schema change.
- No feature is complete without empty, loading, error, and recovery states applicable to it.
- Add virtualization/workers only after realistic fixtures demonstrate a bottleneck.
- Do not call a phase complete from types, CRUD, unit tests, or a build alone.
- Keep [`VALIDATION.md`](VALIDATION.md) evidence current in the same commit that changes status.
