# Deterministic Planner

Status: **Accepted behavioral contract; calibration open**

Implementation: **Not started**

## Purpose

The planner turns deadlines, learning needs, existing obligations, due reviews, and real availability into a useful daily study schedule. It works backwards from exams and assignments, revisits material over time, and adapts without punishing missed days.

An LLM never selects daily work. The same normalized input, planner version, date, and configuration must produce the same output.

## Boundary

The planner is a pure domain engine. React and Dexie are adapters around it.

```ts
generatePlan(input: PlannerInput): PlannerResult
replan(input: ReplanInput): ReplanResult
```

Inputs contain plain snapshots:

- planning date and horizon;
- availability rules and date exceptions;
- exams, assignments, included topics, weights, priorities, difficulty, and effort estimates;
- current topic evidence/mastery;
- due and forecast flashcard reviews;
- incomplete manual and generated tasks;
- completed/skipped work and recent study history;
- session/block preferences and maximum reasonable daily load;
- planner configuration and algorithm version.

Outputs contain no persisted side effects:

- proposed dated task blocks with subject/topic/type/duration/origin;
- daily capacity, allocated time, and spare/shortfall values;
- feasibility status and required average daily time;
- human-readable reason codes for each recommendation;
- changes from the previous future plan;
- warnings and safe recovery suggestions.

The application service persists a successful result atomically as a plan, tasks, and plan-change history.

## Scheduling pipeline

1. **Normalize time.** Expand weekly availability, apply exceptions, subtract fixed commitments if configured, cap each day, and split usable capacity into bounded blocks.
2. **Preserve facts.** Lock completed, in-progress, and manual tasks. Retain already completed effort and immutable learning evidence.
3. **Build obligations.** Convert assignment remaining effort, exam-topic coverage gaps, due reviews, and deliberate practice/revisit needs into remaining work units.
4. **Estimate demand.** Use explicit effort when available; otherwise use conservative defaults adjusted by difficulty, topic importance/weight, mastery gap, recency, and evidence quality.
5. **Score candidates.** Rank eligible work with normalized urgency, importance, mastery gap, difficulty, overdue/review pressure, and prerequisite readiness. Stable IDs break ties.
6. **Allocate backwards.** Place deadline work before its due date while respecting daily capacity and preserving earlier completion margin.
7. **Space and interleave.** Avoid exhausting one topic in a day when future capacity permits revisiting. Mix related retrieval/practice types where it helps, but keep prerequisites and long problem-solving blocks coherent.
8. **Add active-learning shape.** Prefer flashcards, recall, practice, explanation, and problem solving. Reading/notes are scheduled only when they enable learning or assessment.
9. **Evaluate feasibility.** Compare remaining demand with usable capacity per deadline and overall. Never hide excess demand by exceeding configured limits.
10. **Explain and diff.** Return concise reason codes and the changes from the previous plan.

## Priority model

Priority is a composed score, not one opaque magic formula. Components are normalized and tested independently:

- deadline urgency and days remaining;
- exam/assignment importance;
- exam topic weight and topic importance;
- mastery gap and evidence confidence;
- estimated difficulty and remaining effort;
- overdue FSRS review pressure;
- time since meaningful practice;
- prerequisite readiness;
- continuity cost and variety/interleaving benefit.

Hard constraints—availability, deadline feasibility, prerequisite blocks, and max load—are handled separately from ranking. Exact weights are configuration owned by a versioned planner policy and require scenario tests before acceptance.

## Task sizing

- Prefer blocks that fit the user's configured session length and the activity type.
- Do not split below a useful minimum except for due-card reviews or small residual work.
- Preserve longer coherent blocks for programming, essays, simulations, and difficult problem sets.
- Treat FSRS due cards as review demand estimated from due count and measured average review time, then reconcile with actual duration after completion.
- Generated task origin keys prevent accidental duplicates across repeated planning.

## Replanning rules

Replanning runs on app open when the planning day changes, after material completion, after significant deadline/availability changes, and on explicit request. It must be idempotent for unchanged input.

- Past tasks remain historical facts.
- Completed and active tasks never move.
- Missed generated tasks return their remaining demand to the obligation pool; they do not accumulate as red overdue tasks.
- Manual tasks are preserved unless the user explicitly allows rescheduling.
- Only future generated tasks are replaced by a new plan.
- Redistribution respects all remaining deadline windows and max loads.
- A `PlanChange` explains moved minutes by subject/date and whether the plan remains achievable.
- If infeasible, return required capacity and the shortfall. Offer increasing availability, reducing lower-priority scope, or changing priorities; never silently overload.

Example explanation:

> Dynamic Programming was prioritized because the exam is in 8 days, its exam weight is high, current mastery evidence is weak, and there has been no practice in 6 days.

## Assignment interaction

Assignments consume the same capacity as learning tasks. Their remaining effort is `estimate × (1 - progress)` unless subtask estimates give a better total. Near-deadline assignment blocks may outrank exam study, but the feasibility analysis must still show any resulting exam shortfall.

## Mastery and readiness inputs

The planner consumes versioned snapshots; it does not calculate mastery/readiness internally.

- Mastery uses review outcomes, FSRS retrievability, practice accuracy/difficulty, recency, exposures, coverage, and optional self-rating with bounded influence.
- Readiness aggregates weighted topic coverage/mastery, recall, practice, recent activity, and unfinished exam work.
- Both expose components and evidence counts. Low evidence reduces confidence and avoids false precision.

## Test matrix

Pure deterministic tests must cover:

- no deadlines, no availability, and zero-duration windows;
- overlapping/multiple windows and one-off exceptions;
- same-day, past, date-only, and time-zone-sensitive deadlines;
- two competing exams and assignment/exam capacity contention;
- weak difficult near-term topics versus strong or distant topics;
- prerequisite ordering, spacing, interleaving, and maximum daily load;
- due review backlog without starving fixed deadlines;
- partial completion, missed day, changed availability, and changed deadline;
- feasible, barely feasible, and impossible plans;
- repeated identical input producing identical output and no duplicate tasks;
- preservation of manual, completed, and in-progress work;
- clear reason codes and exact capacity accounting.

Scenario fixtures should include the Algorithms/Databases example from the product handoff and realistic semester seed data. Property tests are useful for invariants such as no negative duration, no allocation outside availability, and no work after its deadline.

## Acceptance gate

The planner is not complete until scenario and invariant tests pass, persistence applies outputs transactionally, Today renders the proposal accurately, missed-day replanning is proven end to end, and a user can inspect why work moved.
