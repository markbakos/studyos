import type { Snapshot, Task } from "../types/model";
import { clockMinutes, daysBetween, nextDate } from "./dates";
import { mastery } from "./signals";

export const PLANNER_VERSION = "1.1";
type Block = Omit<Task, "id" | "createdAt" | "updatedAt" | "planId">;
export function capacityFor(date: string, data: Snapshot): number {
  const occupied = new Uint8Array(1440);
  const apply = (start: string, end: string, value: number) =>
    occupied.fill(value, clockMinutes(start), clockMinutes(end));
  const weekday = new Date(`${date}T12:00:00`).getDay();
  for (const rule of data.availabilityRules)
    if (
      rule.weekday === weekday &&
      (!rule.effectiveFrom || rule.effectiveFrom <= date) &&
      (!rule.effectiveTo || rule.effectiveTo >= date)
    )
      apply(rule.startTime, rule.endTime, 1);
  const exceptions = data.availabilityExceptions.filter((e) => e.date === date);
  for (const e of exceptions.filter((e) => e.mode === "add"))
    if (e.startTime && e.endTime) apply(e.startTime, e.endTime, 1);
  for (const e of exceptions.filter((e) => e.mode === "remove"))
    if (e.startTime && e.endTime) apply(e.startTime, e.endTime, 0);
  if (exceptions.some((e) => e.mode === "unavailable")) occupied.fill(0);
  for (const event of data.calendarEvents) {
    const start = new Date(event.startsAt),
      end = new Date(event.endsAt);
    const dayStart = new Date(`${date}T00:00:00`),
      dayEnd = new Date(`${nextDate(date, 1)}T00:00:00`);
    if (start < dayEnd && end > dayStart)
      occupied.fill(
        0,
        start <= dayStart ? 0 : start.getHours() * 60 + start.getMinutes(),
        end >= dayEnd ? 1440 : end.getHours() * 60 + end.getMinutes(),
      );
  }
  return Math.min(
    occupied.reduce((a, b) => a + b, 0),
    data.settings[0]?.dailyLimit ?? 180,
    ...exceptions.filter((e) => e.mode === "cap").map((e) => e.maxMinutes ?? 0),
  );
}
export function generatePlan(data: Snapshot, date: string, horizon = 60) {
  const spaced = allocatePlan(data, date, horizon, true);
  if (!spaced.shortfall) return spaced;
  const compact = allocatePlan(data, date, horizon, false);
  return compact.shortfall < spaced.shortfall ? compact : spaced;
}
function allocatePlan(
  data: Snapshot,
  date: string,
  horizon: number,
  preferSpacing: boolean,
) {
  const activeSubjects = new Set(
    data.subjects.filter((s) => !s.isArchived).map((s) => s.id),
  );
  const days = Array.from({ length: horizon }, (_, i) => {
    const day = nextDate(date, i);
    const locked = data.tasks
      .filter(
        (t) =>
          t.scheduledDate === day &&
          (t.state === "completed" ||
            t.state === "in progress" ||
            (!t.isGenerated && t.state === "planned")),
      )
      .reduce((n, t) => n + t.estimatedMinutes, 0);
    return {
      date: day,
      capacity: capacityFor(day, data),
      locked,
      allocated: 0,
    };
  });
  const obligations: (Block & {
    remaining: number;
    prerequisiteIds: string[];
  })[] = [];
  const add = (
    block: Block,
    minutes: number,
    prerequisiteIds: string[] = [],
  ) => {
    if (minutes > 0 && activeSubjects.has(block.subjectId))
      obligations.push({
        ...block,
        remaining: Math.ceil(minutes),
        prerequisiteIds,
      });
  };
  for (const assignment of data.assignments.filter(
    (a) => a.status !== "completed",
  )) {
    const subtasks = data.assignmentSubtasks.filter(
      (s) => s.assignmentId === assignment.id,
    );
    const estimated = subtasks.some((s) => s.estimatedMinutes > 0)
      ? subtasks
          .filter((s) => !s.isComplete)
          .reduce((n, s) => n + s.estimatedMinutes, 0)
      : assignment.estimatedMinutes * (1 - assignment.progress);
    add(
      {
        subjectId: assignment.subjectId,
        assignmentId: assignment.id,
        title: assignment.title,
        type: "assignment",
        estimatedMinutes: 0,
        dueDate: assignment.dueDate,
        scheduledDate: date,
        priority: 10 + assignment.priority,
        state: "planned",
        isGenerated: true,
        originKey: `assignment:${assignment.id}`,
        explanation: `Assignment due ${assignment.dueDate}; ${Math.ceil(estimated)} minutes remain.`,
      },
      estimated,
    );
  }
  for (const exam of data.exams.filter((e) => e.date >= date)) {
    const links = data.examTopics.filter((l) => l.examId === exam.id);
    for (const link of links) {
      const topic = data.topics.find((t) => t.id === link.topicId);
      if (!topic) continue;
      const signal = mastery(topic, data, `${date}T12:00:00.000Z`);
      const done = data.tasks
        .filter(
          (t) =>
            t.examId === exam.id &&
            t.topicId === topic.id &&
            ["completed", "in progress"].includes(t.state),
        )
        .reduce((n, t) => n + t.estimatedMinutes, 0);
      const estimate =
        link.estimatedMinutes ??
        (exam.estimatedMinutes
          ? (exam.estimatedMinutes * link.weight) /
            links.reduce((n, l) => n + l.weight, 0)
          : topic.estimatedMinutes * (0.7 + topic.difficulty * 0.1));
      const minutes = Math.max(0, estimate * (1 - signal.score * 0.7) - done);
      add(
        {
          subjectId: exam.subjectId,
          topicId: topic.id,
          examId: exam.id,
          title: `Recall & practice: ${topic.title}`,
          type: data.questions.some((q) => q.topicIds.includes(topic.id))
            ? "practice"
            : "learn",
          estimatedMinutes: 0,
          scheduledDate: date,
          dueDate: exam.date,
          priority:
            exam.importance +
            topic.importance +
            link.weight +
            topic.difficulty * 0.2 +
            (1 - signal.score) * 3 +
            10 / (1 + daysBetween(exam.date, date)),
          state: "planned",
          isGenerated: true,
          originKey: `exam:${exam.id}:${topic.id}`,
          explanation: `${exam.title} in ${daysBetween(exam.date, date)} days; topic weight ${link.weight}, difficulty ${topic.difficulty}/5, ${signal.band.toLowerCase()}.`,
        },
        minutes,
        topic.prerequisiteTopicIds,
      );
    }
  }
  for (const subject of data.subjects.filter((s) => !s.isArchived)) {
    const due = data.flashcards.filter(
      (c) =>
        c.subjectId === subject.id &&
        !c.isSuspended &&
        c.due.slice(0, 10) <= date,
    );
    add(
      {
        subjectId: subject.id,
        title: `Review ${due.length} due cards`,
        type: "flashcards",
        estimatedMinutes: 0,
        scheduledDate: date,
        dueDate: date,
        priority: 30,
        state: "planned",
        isGenerated: true,
        originKey: `reviews:${subject.id}:${date}`,
        explanation: `${due.length} cards are due for spaced retrieval.`,
      },
      due.length,
    );
  }
  obligations.sort(
    (a, b) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
      b.priority - a.priority ||
      a.originKey!.localeCompare(b.originKey!),
  );
  const tasks: Block[] = [];
  const sessionMinutes = data.settings[0]?.sessionMinutes ?? 25;
  const requiredMinutes = obligations.reduce((n, o) => n + o.remaining, 0);
  // ponytail: bounded 60-day greedy scheduling; replace with a solver only if scenario evidence warrants it.
  for (const day of days) {
    let available = Math.max(0, day.capacity - day.locked);
    const touched = new Map<string, number>();
    while (available > 0) {
      const candidates = obligations.filter(
        (o) =>
          o.remaining > 0 &&
          (o.dueDate ?? day.date) >= day.date &&
          (!preferSpacing ||
            !o.topicId ||
            (touched.get(o.topicId) ?? 0) < sessionMinutes ||
            !days.some(
              (future) =>
                future.date > day.date &&
                future.date <= (o.dueDate ?? day.date) &&
                future.capacity - future.locked >= Math.min(5, o.remaining),
            )) &&
          o.prerequisiteIds.every(
            (id) =>
              !obligations.some((p) => p.topicId === id && p.remaining > 0),
          ),
      );
      candidates.sort(
        (a, b) =>
          (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
          (touched.get(a.topicId ?? a.originKey!) ?? 0) -
            (touched.get(b.topicId ?? b.originKey!) ?? 0) ||
          b.priority - a.priority ||
          a.originKey!.localeCompare(b.originKey!),
      );
      const item = candidates[0];
      if (!item) break;
      const length = Math.min(available, sessionMinutes, item.remaining);
      if (length < 5 && item.remaining >= 5 && item.type !== "flashcards")
        break;
      const {
        remaining: _remaining,
        prerequisiteIds: _prerequisiteIds,
        ...block
      } = item;
      tasks.push({
        ...block,
        estimatedMinutes: length,
        scheduledDate: day.date,
        explanation: `${block.explanation}${preferSpacing && block.topicId ? " Study blocks are spread across available days where deadlines permit." : ""}`,
        originKey: `${item.originKey}:${day.date}:${tasks.length}`,
      });
      item.remaining -= length;
      available -= length;
      day.allocated += length;
      const key = item.topicId ?? item.originKey!;
      touched.set(key, (touched.get(key) ?? 0) + length);
    }
  }
  const shortfall = obligations.reduce((n, o) => n + o.remaining, 0);
  const capacity = days.reduce(
    (n, d) => n + Math.max(0, d.capacity - d.locked),
    0,
  );
  const lockedOverload = days.reduce(
    (n, d) => n + Math.max(0, d.locked - d.capacity),
    0,
  );
  const warnings = obligations
    .filter((o) => o.remaining > 0)
    .map(
      (o) =>
        `${o.title}: ${o.remaining} minutes cannot fit before ${o.dueDate}. Increase availability, reduce scope, or adjust the deadline.`,
    );
  if (lockedOverload)
    warnings.push(
      `Existing manual or active work exceeds capacity by ${lockedOverload} minutes. Review those tasks.`,
    );
  return {
    tasks,
    days,
    shortfall,
    requiredMinutes,
    capacity,
    warnings,
    status:
      shortfall || lockedOverload
        ? ("infeasible" as const)
        : ("feasible" as const),
  };
}
