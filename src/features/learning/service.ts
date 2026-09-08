import type { Grade } from "ts-fsrs";
import { db, snapshot } from "../../db/schema";
import { identity, type Records } from "../../types/model";
import {
  elapsedSeconds,
  gradeAnswer,
  scheduleReview,
} from "../../engine/learning";
import { mastery, readiness } from "../../engine/signals";

async function recordSignals(now: string) {
  const data = await snapshot();
  await db
    .records("masterySnapshots")
    .bulkAdd(
      data.topics.map((topic) => ({
        ...identity(now),
        topicId: topic.id,
        calculatedAt: now,
        engineVersion: "1.0",
        ...mastery(topic, data, now),
      })),
    );
  await db
    .records("readinessSnapshots")
    .bulkAdd(
      data.exams.map((exam) => ({
        ...identity(now),
        examId: exam.id,
        calculatedAt: now,
        engineVersion: "1.0",
        ...readiness(exam.id, data, now),
      })),
    );
}
export async function reviewCard(
  id: string,
  rating: Grade,
  expectedUpdatedAt: string,
  seconds: number,
  sessionId?: string,
) {
  await db.transaction("rw", db.tables, async () => {
    const card = await db.records("flashcards").get(id);
    if (!card || card.isSuspended || card.updatedAt !== expectedUpdatedAt)
      throw new Error(
        "This card changed in another tab. Reload the review queue.",
      );
    const now = new Date().toISOString(),
      result = scheduleReview(card, rating, now);
    await db
      .records("reviews")
      .add({
        ...identity(now),
        flashcardId: id,
        sessionId,
        reviewedAt: now,
        rating,
        previousState: card.fsrsState,
        nextState: result.state,
        elapsedSeconds: Math.max(0, seconds),
        schedulerVersion: result.version,
      });
    await db
      .records("flashcards")
      .update(id, {
        fsrsState: result.state,
        due: result.state.due,
        updatedAt: now,
      });
    await recordSignals(now);
  });
}
export async function answerQuestion(
  id: string,
  answer: string,
  manualScore: number,
  usedHint: boolean,
  seconds: number,
  sessionId?: string,
) {
  await db.transaction("rw", db.tables, async () => {
    const question = await db.records("questions").get(id);
    if (!question) throw new Error("Question no longer exists.");
    const score = gradeAnswer(question, answer) ?? manualScore;
    if (![0, 0.5, 1].includes(score)) throw new Error("Choose an assessment.");
    const now = new Date().toISOString();
    await db
      .records("attempts")
      .add({
        ...identity(now),
        questionId: id,
        sessionId,
        attemptedAt: now,
        answer,
        grade:
          score === 1 ? "correct" : score === 0.5 ? "partial" : "incorrect",
        score,
        usedHint,
        elapsedSeconds: Math.max(0, seconds),
      });
    await recordSignals(now);
  });
}
export async function startSession(taskId?: string, subjectId?: string) {
  return db.transaction(
    "rw",
    [
      db.table("sessions"),
      db.table("sessionItems"),
      db.table("tasks"),
      db.table("settings"),
    ],
    async () => {
      const existing = await db
        .records("sessions")
        .where("state")
        .anyOf("active", "paused")
        .first();
      if (existing) return existing;
      const task = taskId ? await db.records("tasks").get(taskId) : undefined;
      if (taskId && (!task || task.state !== "planned"))
        throw new Error("This task is no longer available.");
      const now = new Date().toISOString();
      const session: Records["sessions"] = {
        ...identity(now),
        subjectId: task?.subjectId ?? subjectId,
        startedAt: now,
        runningSince: now,
        plannedMinutes:
          task?.estimatedMinutes ??
          (await db.records("settings").get("settings"))?.sessionMinutes ??
          25,
        actualMinutes: 0,
        elapsedSeconds: 0,
        state: "active",
        notes: "",
      };
      await db.records("sessions").add(session);
      if (task) {
        await db
          .records("tasks")
          .update(task.id, { state: "in progress", updatedAt: now });
        await db
          .records("sessionItems")
          .add({
            ...identity(now),
            sessionId: session.id,
            studyTaskId: task.id,
            subjectId: task.subjectId,
            topicId: task.topicId,
            kind: task.type,
            title: task.title,
            plannedMinutes: task.estimatedMinutes,
            actualMinutes: 0,
            position: 0,
            state: "planned",
          });
      }
      return session;
    },
  );
}
export async function changeSession(
  id: string,
  action: "pause" | "resume" | "finish" | "abandon",
  notes = "",
  focusRating = 3,
) {
  await db.transaction("rw", db.tables, async () => {
    const session = await db.records("sessions").get(id);
    if (!session || !["active", "paused"].includes(session.state))
      throw new Error("This session has already ended.");
    const now = new Date().toISOString(),
      seconds = elapsedSeconds(session, now);
    const final = action === "finish" || action === "abandon";
    await db
      .records("sessions")
      .update(id, {
        state:
          action === "finish"
            ? "completed"
            : action === "abandon"
              ? "abandoned"
              : action === "pause"
                ? "paused"
                : "active",
        elapsedSeconds: seconds,
        runningSince: action === "resume" ? now : undefined,
        actualMinutes: seconds / 60,
        endedAt: final ? now : undefined,
        notes: notes || session.notes,
        focusRating,
        updatedAt: now,
      });
    if (final) {
      for (const item of await db
        .records("sessionItems")
        .where("sessionId")
        .equals(id)
        .toArray()) {
        await db
          .records("sessionItems")
          .update(item.id, {
            actualMinutes: seconds / 60,
            state: action === "finish" ? "completed" : "planned",
            updatedAt: now,
          });
        if (item.studyTaskId) {
          const task = await db.records("tasks").get(item.studyTaskId);
          await db
            .records("tasks")
            .update(item.studyTaskId, {
              state: action === "finish" ? "completed" : "planned",
              completedAt: action === "finish" ? now : undefined,
              updatedAt: now,
            });
          if (action === "finish" && task?.assignmentId) {
            const assignment = await db
              .records("assignments")
              .get(task.assignmentId);
            if (assignment) {
              const progress = Math.min(
                1,
                assignment.progress +
                  task.estimatedMinutes /
                    Math.max(1, assignment.estimatedMinutes),
              );
              await db
                .records("assignments")
                .update(assignment.id, {
                  progress,
                  status: progress === 1 ? "completed" : "open",
                  updatedAt: now,
                });
            }
          }
        }
      }
      await recordSignals(now);
    }
  });
}
