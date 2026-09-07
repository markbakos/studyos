import { db, snapshot } from "../../db/schema";
import { identity } from "../../types/model";
import { generatePlan, PLANNER_VERSION } from "../../engine/planner";
import { nextDate, today } from "../../engine/dates";

export async function replan(
  reason = "Planning inputs updated",
  date = today(),
) {
  return db.transaction("rw", db.tables, async () => {
    const data = await snapshot();
    const fingerprint = JSON.stringify([
      date,
      PLANNER_VERSION,
      data.subjects,
      data.topics,
      data.exams,
      data.examTopics,
      data.assignments,
      data.assignmentSubtasks,
      data.availabilityRules,
      data.availabilityExceptions,
      data.calendarEvents,
      data.flashcards,
      data.questions,
      data.reviews,
      data.attempts,
      data.settings.map((s) => [s.sessionMinutes, s.dailyLimit]),
      data.tasks.filter(
        (t) => !t.isGenerated || ["completed", "in progress"].includes(t.state),
      ),
    ]);
    const previous = data.plans
      .sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))
      .at(-1);
    if (previous?.inputFingerprint === fingerprint) return previous;
    const result = generatePlan(data, date);
    const now = new Date().toISOString();
    const replaced = data.tasks.filter(
      (t) => t.isGenerated && t.state === "planned",
    );
    for (const task of replaced)
      await db
        .records("tasks")
        .update(task.id, { state: "cancelled", updatedAt: now });
    const summary = `${result.tasks.length} blocks planned. ${result.shortfall ? `${result.shortfall} minutes do not fit. Increase availability, reduce scope, or adjust deadlines.` : "Your workload fits your availability."}`;
    const plan = {
      ...identity(now),
      rangeStart: date,
      rangeEnd: nextDate(date, 59),
      generatedAt: now,
      algorithmVersion: PLANNER_VERSION,
      inputFingerprint: fingerprint,
      status: result.status,
      summary: `${summary}${result.warnings.length ? "\n" + result.warnings.join("\n") : ""}`,
      shortfall: result.shortfall,
      requiredMinutes: result.requiredMinutes,
      capacity: result.capacity,
    };
    await db.records("plans").add(plan);
    await db.records("tasks").bulkAdd(
      result.tasks.map((task) => ({
        ...task,
        ...identity(now),
        planId: plan.id,
      })),
    );
    const missed = replaced
      .filter((t) => t.scheduledDate < date)
      .reduce((n, t) => n + t.estimatedMinutes, 0);
    await db.records("planChanges").add({
      ...identity(now),
      fromPlanId: previous?.id,
      toPlanId: plan.id,
      reason,
      summary: `${missed ? `${missed} missed minutes returned to the plan. ` : ""}${summary}`,
      affectedTaskIds: replaced.map((t) => t.id),
      movedMinutes: missed,
      capacityBefore: previous?.capacity ?? 0,
      capacityAfter: result.capacity,
    });
    await db
      .records("appMeta")
      .update("meta", { lastPlanDay: date, updatedAt: now });
    return plan;
  });
}
