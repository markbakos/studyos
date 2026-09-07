# Data Model

Status: **Accepted initial model**

Implementation: **Initial runtime schemas and Dexie V1 exist; the model below remains the target contract. See [VALIDATION.md](VALIDATION.md) for tested behavior.**

This is the logical model. Current Dexie table/index syntax lives in `src/db/schema.ts`; runtime validation lives in `src/types/model.ts`.

## Shared conventions

```ts
type Id = string // crypto.randomUUID()
type Instant = string // UTC ISO 8601 instant
type LocalDate = string // YYYY-MM-DD
type LocalTime = string // HH:mm

interface Entity {
  id: Id
  createdAt: Instant
  updatedAt: Instant
}
```

- References use stable IDs, never array positions or auto-increment keys.
- Date-only deadlines remain date-only so time-zone conversion cannot move them to another day.
- Records that represent evidence or history are append-only.
- Mutable aggregate records update `updatedAt`; no speculative sync revision fields are added before sync exists.
- Deletion rules are explicit per aggregate. History referenced by analytics is not silently cascaded away.
- User-authored Markdown is stored as source text and rendered safely; never persist executable HTML as trusted content.

## Academic organization

### Subject

Fields: `name`, `shortName?`, `description?`, `color`, `icon?`, `term?`, `priority`, `isArchived`, timestamps.

Indexes: normalized name where needed, `term`, `isArchived`, `updatedAt`.

Owns or is referenced by topics, exams, assignments, materials, notes, cards, questions, tasks, sessions, and history. Archiving hides a subject from active planning without deleting it.

### Topic

Fields: `subjectId`, `parentTopicId?`, `title`, `description?`, `importance`, `difficulty`, `estimatedMinutes?`, `manualConfidence?`, `position`, timestamps.

Indexes: `subjectId`, `[subjectId+parentTopicId]`, `parentTopicId`, `updatedAt`.

The hierarchy must be acyclic, remain inside one subject, and preserve a stable sibling order. Mastery and last-studied values are derived from evidence/snapshots, not authoritative editable topic fields.

### Material

Fields: `subjectId`, `topicIds`, `kind`, `title`, `description?`, `url?`, `citation?`, `storageMode`, `blobId?`, `externalFileMetadata?`, `sizeBytes?`, timestamps.

Kinds include PDF, slides, web link, textbook reference, Markdown, and custom. `storageMode` distinguishes stored browser content from a reference that may require reopening. Large blob persistence requires explicit consent and quota feedback.

### MaterialBlob

Fields: `materialId`, `blob`, `mimeType`, `sizeBytes`, checksum, timestamps.

Keep blob bytes separate from searchable metadata so normal material queries remain cheap. One blob per stored material is sufficient for V1.

### Note

Fields: `subjectId?`, `topicIds`, `title`, `markdown`, `sourceMaterialIds`, timestamps.

Notes support Markdown, code blocks, tables, links, and math rendering. Search indexes derived plain text rather than unsafe rendered HTML.

## Deadlines and time

### Exam

Fields: `subjectId`, `title`, `date`, `time?`, `timeZone?`, `location?`, `description?`, `importance`, `difficulty`, `targetReadiness`, `estimatedMinutes?`, `notes?`, timestamps.

Indexes: `subjectId`, `date`, `[subjectId+date]`.

### ExamTopic

Fields: `examId`, `topicId`, `weight`, `estimatedMinutes?`, timestamps.

Unique logical key: `[examId+topicId]`. The topic must belong to the exam subject. Weight is relative and need not sum to 1; the planner normalizes positive weights.

### Assignment

Fields: `subjectId`, `title`, `dueDate`, `dueTime?`, `timeZone?`, `estimatedMinutes`, `priority`, `status`, `progress`, `description?`, `topicIds`, timestamps.

Indexes: `subjectId`, `dueDate`, `status`, `[status+dueDate]`.

### AssignmentSubtask

Fields: `assignmentId`, `title`, `estimatedMinutes?`, `isComplete`, `position`, timestamps.

### CalendarEvent

Fields: `subjectId?`, `kind`, `title`, `startsAt`, `endsAt`, `location?`, `notes?`, `linkedEntityType?`, `linkedEntityId?`, timestamps.

Exam and assignment records remain first-class. Their calendar projection should be derived; do not duplicate them as mutable generic events. `CalendarEvent` stores lectures, manual events, and other standalone events.

### AvailabilityRule

Fields: `weekday`, `startTime`, `endTime`, `effectiveFrom?`, `effectiveTo?`, timestamps.

Multiple non-overlapping windows per weekday are allowed. Overnight windows are split at midnight for V1.

### AvailabilityException

Fields: `date`, `mode`, `startTime?`, `endTime?`, `maxMinutes?`, `reason?`, timestamps.

Modes: unavailable, add window, remove window, or cap day. Exceptions are applied after weekly rules.

## Planning and sessions

### StudyPlan

Fields: `rangeStart`, `rangeEnd`, `generatedAt`, `algorithmVersion`, `inputFingerprint`, `status`, `summary`, timestamps.

Plans are generation records. Replanning creates a new plan and a change record instead of erasing why previous tasks existed.

### StudyTask

Fields: `planId?`, `subjectId`, `topicId?`, `examId?`, `assignmentId?`, `type`, `title`, `estimatedMinutes`, `scheduledDate`, `dueDate?`, `priority`, `state`, `isGenerated`, `originKey?`, `explanation`, completion fields, timestamps.

Indexes: `scheduledDate`, `state`, `[scheduledDate+state]`, `subjectId`, `topicId`, `planId`, `dueDate`.

Types: learn, review, flashcards, practice, assignment, reading, notes, exam simulation, custom. States: planned, in progress, completed, skipped, cancelled. Generated future work may be replaced during replanning; completed and active work is preserved.

### PlanChange

Append-only fields: `fromPlanId?`, `toPlanId`, `createdAt`, `reason`, `summary`, `affectedTaskIds`, capacity before/after, feasibility before/after.

### StudySession

Fields: `subjectId?`, `planId?`, `plannedMinutes`, `actualMinutes`, `startedAt`, `endedAt?`, `state`, `focusRating?`, `notes?`, timestamps.

States: active, paused, completed, abandoned. A recoverable active session stores enough timing state to resume after reload.

### StudySessionItem

Fields: `sessionId`, `studyTaskId?`, `subjectId`, `topicId?`, `kind`, `title`, `plannedMinutes`, `actualMinutes?`, `position`, `state`, result summary, timestamps.

Session items record the planned sequence; attempts and reviews store detailed learning evidence separately.

## Active learning evidence

### Flashcard

Fields: `subjectId`, `topicIds`, `type`, `front`, `back`, `explanation?`, `sourceMaterialId?`, `sourceReference?`, `tags`, `isGenerated`, `isSuspended`, `fsrsState`, timestamps.

`fsrsState` contains the exact supported `ts-fsrs` card fields required to schedule the next review. Index due date and suspension state for bounded review queries. Card types: basic, reversible, cloze, typed, multiple choice, definition, and optional code.

### FlashcardReview

Append-only fields: `flashcardId`, `sessionId?`, `reviewedAt`, `rating`, previous scheduling state, next scheduling state, elapsed time, `schedulerVersion`, timestamps.

Again, Hard, Good, and Easy are persisted as FSRS-compatible ratings. Never recompute or overwrite historical reviews when scheduler parameters change.

### PracticeQuestion

Fields: `subjectId`, `topicIds`, `type`, `prompt`, `expectedAnswer?`, `choices?`, `correctChoiceIds?`, `explanation?`, `rubric?`, `difficulty`, `sourceMaterialId?`, `sourceReference?`, `hints`, `tags`, `isGenerated`, timestamps.

Types: multiple choice, true/false, short answer, long answer, numeric, programming, essay, custom.

### PracticeAttempt

Append-only fields: `questionId`, `sessionId?`, `attemptedAt`, `answer?`, `grade`, `score?`, `elapsedSeconds?`, `usedHint`, `notes?`, timestamps.

Manual grades include incorrect, partial, correct, and easy. Objective question types may also store a deterministic score.

### MasterySnapshot

Append-only fields: `topicId`, `calculatedAt`, `engineVersion`, normalized `score`, friendly band, evidence counts, component scores, reason codes.

This is a transparent study signal, not an editable truth or grade prediction. Last studied is derived from evidence.

### ReadinessSnapshot

Append-only fields: `examId`, `calculatedAt`, `engineVersion`, normalized `score`, coverage, recall, practice, recency, remainingMinutes, weakestTopicIds, reason codes.

## Portability and configuration

### StudyPack

Fields: `title`, `description?`, `formatVersion`, `sourceMetadata`, content counts, `importedAt?`, timestamps. This records an imported/exported logical pack, not a second copy of all content.

### ImportRecord

Append-only fields: `kind`, `fileName`, `sourceFingerprint`, `formatVersion`, `startedAt`, `completedAt?`, `status`, target subject, created entity IDs/counts, warnings, safe error summary.

Failed imports record no created entities. The import transaction and success record commit together.

### Settings

Singleton keyed by a stable ID. Fields include locale, theme, week start, preferred session length, daily load limit, FSRS parameters, onboarding state, backup reminder interval/last export, storage status last checked, and accessibility preferences.

### AppMeta

Singleton metadata: logical app data version, first/last opened timestamps, last successful backup, and migration diagnostics safe to show to the user.

## Deletion and history

- Default to archive for subjects and suspend for cards.
- Permanent aggregate deletion requires confirmation and a transaction that handles dependents explicitly.
- Reviews, attempts, sessions, imports, and plan changes are not silently overwritten.
- If the user permanently deletes a subject, the UI previews affected records and recommends a backup first.
- Restore and import never partially apply.

## Migration policy

1. Add a new monotonically increasing Dexie version for every index/table/schema change.
2. Keep all earlier version declarations so old profiles can upgrade directly.
3. Make each transform deterministic and safe to rerun in isolated migration tests.
4. Add defaults or transform existing records before new code assumes a field exists.
5. Test a fresh database, the immediately previous version, and representative older fixtures.
6. Back up before risky user-triggered maintenance; never solve migration failure by deleting the database.

## Open design details

- Exact mastery and readiness component weights require test fixtures and calibration.
- Material blob size thresholds require browser quota testing.
- Search may begin with normalized indexed fields; a separate token index is added only when measured data warrants it.
