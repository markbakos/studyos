# Product Contract

Status: **Confirmed**

Implementation: **Initial product implementation exists in the working tree; V1 journeys and release gates remain unvalidated. See [VALIDATION.md](VALIDATION.md).**

## Vision

StudyOS is a personal study operating system for university and any other long-term learning. The user tells it what they need to learn, when they need to know it, and how much time they have. StudyOS continuously answers:

- What should I study today?
- What exams and assignments are approaching?
- What am I weak at?
- How prepared am I?
- What should I study next?
- Am I on track?

The product removes planning overhead and drives active study. It is not a notes-first workspace or a calendar clone.

## Product principles

1. **Local first.** Core academic and study data lives in the browser and works without an application backend, account, cloud service, or internet connection.
2. **AI optional.** Manual use is complete. External tools may generate portable Study Packs; the browser app never depends on or shells out to a model provider.
3. **Deterministic planning.** Tested algorithms schedule work from dates, workload, importance, difficulty, mastery, history, reviews, and availability. LLMs do not choose daily work.
4. **Active learning.** Retrieval practice, spaced repetition, practice questions, problem solving, and weak-topic review take priority over passive organization.
5. **Compassionate replanning.** Missed work is redistributed. The product explains the change and exposes overload without guilt or an overdue-task wall.
6. **Portable ownership.** Important data supports versioned export and import. Local data does not silently synchronize across devices.
7. **Explainable signals.** Recommendations, mastery, and readiness show useful contributing reasons and never pretend to predict an exam grade.
8. **Data safety before convenience.** History is preserved, migrations are forward-safe, imports are transactional, and destructive restore is explicit.

## Core experience

The default route is **Today**, optimized for immediate action:

- next important exam and days remaining;
- StudyOS readiness with contributing signals;
- today's ordered study tasks and total time;
- reviews due, deadlines, and realistic-capacity warnings;
- one clear Start Study Session action;
- concise recent progress where useful.

The responsive primary navigation is:

- Today
- Calendar
- Subjects
- Study
- Flashcards
- Practice
- Progress
- Search
- Create With AI
- Settings

Desktop may use a sidebar and optional contextual panel. Mobile uses a reduced bottom-level navigation centered on Today, Calendar, Study, Subjects, and More. Mobile is a deliberately composed experience, not a shrunken desktop shell.

## Functional domains

- Subjects and hierarchical topics
- Exams and assignments
- Academic calendar and availability
- Deterministic planning and automatic replanning
- Today tasks and guided study sessions
- Focus timer with pause, resume, and finish
- Flashcards scheduled by FSRS
- Practice questions and immutable attempts
- Evidence-based topic mastery and StudyOS exam readiness
- Lightweight Markdown/math notes and materials
- Global search and command palette (`Ctrl+K`)
- Study Pack import/export
- task-specific prompts for external AI generation and pasted Study Pack import
- Full backup/restore and local reminders
- Restrained progress analytics and study history
- Settings, storage status, theme, and onboarding

## Required UX behavior

- Empty states explain why the feature matters and offer the next useful action.
- The app is usable without completing onboarding; onboarding should only create a first subject, an optional exam, availability, optional topics, and a first plan.
- Study sessions mix appropriate active-learning modes without forcing interleaving where it harms the material.
- Warnings compare required work with configured capacity and offer concrete choices.
- The product tone is calm and factual: report incomplete work and redistribution, never failure or shame.
- Light and dark themes, semantic HTML, keyboard access, visible focus, labels, contrast, and non-color status cues are baseline requirements.
- No hidden analytics, telemetry, advertising, or academic-data transfer.

## V1 production scope

V1 includes:

- responsive application shell and onboarding;
- IndexedDB with versioned migrations and repositories;
- settings and persistent-storage status;
- subjects, hierarchical topics, exams, assignments, availability, and study calendar;
- deterministic planning, Today, missed-work replanning, and explanations;
- study tasks, guided sessions, and focus timer;
- flashcards, FSRS scheduling, review history, practice questions, and attempt history;
- simple transparent mastery and exam readiness;
- versioned Study Pack schema, preview, transactional import, export, and import history;
- versioned full backup and destructive restore safeguards;
- global search and basic useful analytics;
- static deployment, installable PWA, offline shell, and responsive mobile flows;
- automated tests for domain engines, persistence boundaries, and critical journeys.

CRUD pages alone do not satisfy V1.

## Explicitly deferred

- authentication, accounts, payments, teacher or social features;
- multiplayer, collaboration, chat, and public profiles;
- built-in model-provider calls or AI billing;
- cloud or calendar synchronization;
- native Android/iOS applications;
- advanced Notion-style editing;
- competitive gamification;
- optional Pomodoro modes and other timer expansion.

Future sync adapters may target WebDAV, Dropbox, Google Drive, or a custom backend only after the local core is excellent. Do not build their extension points before a real adapter requires them beyond stable IDs and timestamps.

## Critical journeys

1. Create subject → topics → exam → availability → plan → see today's tasks.
2. Open Today → start session → study → answer questions/review cards → finish → progress updates.
3. Miss a planned day → reopen → plan recalculates → understand what changed and whether it fits.
4. Select Study Pack → validate → preview → import → use its topics/cards/questions in planning.
5. Export backup → clear a test profile → restore → verify complete recovery.

## Definition of done

StudyOS is genuinely usable only when all five critical journeys work on a new browser profile, core data remains usable offline, the app can be installed and used on a phone browser, history survives migrations, and backup restoration is proven. Readiness and mastery must update from real learning evidence, and missed work must replan without silent overload.
