import { z } from "zod";

const id = z.string().min(1).max(200);
const text = z.string().max(100000);
const title = z.string().trim().min(1).max(300);
const instant = z.iso.datetime();
export const localDate = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const score = z.number().min(0).max(1);
const level = z.number().int().min(1).max(5);
const minutes = z.number().min(0).max(100000);
const ids = z.array(id).max(10000);
const entity = { id, createdAt: instant, updatedAt: instant };
const subjectId = id;
const topicIds = ids.default([]);
const provenance = {
  sourceReferences: ids.default([]),
  tags: z.array(z.string().max(100)).max(100).default([]),
};
export const fsrsSchema = z
  .object({
    due: instant,
    stability: z.number().nonnegative(),
    difficulty: z.number().nonnegative(),
    elapsed_days: z.number().nonnegative(),
    scheduled_days: z.number().nonnegative(),
    learning_steps: z.number().nonnegative(),
    reps: z.number().nonnegative(),
    lapses: z.number().nonnegative(),
    state: z.number().int().min(0).max(3),
    last_review: instant.optional(),
  })
  .strict();
export const schemas = {
  subjects: z
    .object({
      ...entity,
      name: title,
      shortName: text.default(""),
      description: text.default(""),
      color: z
        .string()
        .regex(/^#[\da-fA-F]{6}$/)
        .default("#5268d9"),
      term: text.default(""),
      priority: level.default(3),
      isArchived: z.boolean().default(false),
    })
    .strict(),
  topics: z
    .object({
      ...entity,
      subjectId,
      parentTopicId: id.optional(),
      title,
      description: text.default(""),
      importance: level.default(3),
      difficulty: level.default(3),
      estimatedMinutes: minutes.default(120),
      manualConfidence: score.optional(),
      position: z.number().int().nonnegative().default(0),
      prerequisiteTopicIds: ids.default([]),
      ...provenance,
    })
    .strict(),
  exams: z
    .object({
      ...entity,
      subjectId,
      title,
      date: localDate,
      time: time.optional(),
      timeZone: text.default(""),
      location: text.default(""),
      description: text.default(""),
      importance: level.default(3),
      difficulty: level.default(3),
      targetReadiness: score.default(0.8),
      estimatedMinutes: minutes.optional(),
    })
    .strict(),
  examTopics: z
    .object({
      ...entity,
      examId: id,
      topicId: id,
      weight: z.number().positive().max(100).default(1),
      estimatedMinutes: minutes.optional(),
    })
    .strict(),
  assignments: z
    .object({
      ...entity,
      subjectId,
      title,
      dueDate: localDate,
      estimatedMinutes: minutes,
      priority: level.default(3),
      status: z.enum(["open", "completed"]).default("open"),
      progress: score.default(0),
      description: text.default(""),
      topicIds,
    })
    .strict(),
  assignmentSubtasks: z
    .object({
      ...entity,
      assignmentId: id,
      title,
      estimatedMinutes: minutes.default(0),
      isComplete: z.boolean().default(false),
      position: z.number().int().nonnegative(),
    })
    .strict(),
  availabilityRules: z
    .object({
      ...entity,
      weekday: z.number().int().min(0).max(6),
      startTime: time,
      endTime: time,
      effectiveFrom: localDate.optional(),
      effectiveTo: localDate.optional(),
    })
    .strict(),
  availabilityExceptions: z
    .object({
      ...entity,
      date: localDate,
      mode: z.enum(["unavailable", "add", "remove", "cap"]),
      startTime: time.optional(),
      endTime: time.optional(),
      maxMinutes: minutes.optional(),
      reason: text.default(""),
    })
    .strict(),
  calendarEvents: z
    .object({
      ...entity,
      subjectId: id.optional(),
      title,
      kind: z.enum(["lecture", "event"]).default("event"),
      startsAt: instant,
      endsAt: instant,
      location: text.default(""),
      notes: text.default(""),
    })
    .strict(),
  notes: z
    .object({
      ...entity,
      subjectId,
      topicIds,
      title,
      markdown: text,
      sourceMaterialIds: ids.default([]),
      ...provenance,
    })
    .strict(),
  materials: z
    .object({
      ...entity,
      subjectId,
      topicIds,
      title,
      kind: z.enum(["pdf", "slides", "web", "textbook", "markdown", "custom"]),
      storageMode: z.enum(["reference", "stored"]),
      url: z.string().max(2000).default(""),
      citation: text.default(""),
      blobId: id.optional(),
      sizeBytes: z.number().nonnegative().default(0),
    })
    .strict(),
  materialBlobs: z
    .object({
      ...entity,
      materialId: id,
      mimeType: z.string().max(200),
      sizeBytes: z.number().int().nonnegative(),
      checksum: z.string().length(64),
      base64: z.string().max(30000000),
    })
    .strict(),
  tasks: z
    .object({
      ...entity,
      planId: id.optional(),
      subjectId,
      topicId: id.optional(),
      examId: id.optional(),
      assignmentId: id.optional(),
      type: z.enum([
        "learn",
        "review",
        "flashcards",
        "practice",
        "assignment",
        "reading",
        "notes",
        "exam simulation",
        "custom",
      ]),
      title,
      estimatedMinutes: minutes,
      scheduledDate: localDate,
      dueDate: localDate.optional(),
      priority: z.number(),
      state: z
        .enum(["planned", "in progress", "completed", "skipped", "cancelled"])
        .default("planned"),
      isGenerated: z.boolean(),
      originKey: id.optional(),
      explanation: text,
      completedAt: instant.optional(),
    })
    .strict(),
  plans: z
    .object({
      ...entity,
      rangeStart: localDate,
      rangeEnd: localDate,
      generatedAt: instant,
      algorithmVersion: z.string(),
      inputFingerprint: text,
      status: z.enum(["feasible", "infeasible"]),
      summary: text,
      shortfall: minutes,
      requiredMinutes: minutes,
      capacity: minutes,
    })
    .strict(),
  planChanges: z
    .object({
      ...entity,
      fromPlanId: id.optional(),
      toPlanId: id,
      reason: text,
      summary: text,
      affectedTaskIds: ids,
      movedMinutes: minutes,
      capacityBefore: minutes,
      capacityAfter: minutes,
    })
    .strict(),
  sessions: z
    .object({
      ...entity,
      subjectId: id.optional(),
      plannedMinutes: minutes,
      actualMinutes: minutes.default(0),
      startedAt: instant,
      endedAt: instant.optional(),
      state: z.enum(["active", "paused", "completed", "abandoned"]),
      elapsedSeconds: z.number().nonnegative(),
      runningSince: instant.optional(),
      focusRating: level.optional(),
      notes: text.default(""),
    })
    .strict(),
  sessionItems: z
    .object({
      ...entity,
      sessionId: id,
      studyTaskId: id.optional(),
      subjectId,
      topicId: id.optional(),
      kind: title,
      title,
      plannedMinutes: minutes,
      actualMinutes: minutes.default(0),
      position: z.number().int().nonnegative(),
      state: z.enum(["planned", "completed"]),
    })
    .strict(),
  flashcards: z
    .object({
      ...entity,
      subjectId,
      topicIds,
      type: z.enum([
        "basic",
        "reversible",
        "cloze",
        "typed",
        "multiple choice",
        "definition",
        "code",
      ]),
      front: title.or(z.string().min(1).max(10000)),
      back: z.string().min(1).max(10000),
      explanation: text.default(""),
      ...provenance,
      isGenerated: z.boolean().default(false),
      isSuspended: z.boolean().default(false),
      fsrsState: fsrsSchema,
      due: instant,
    })
    .strict(),
  reviews: z
    .object({
      ...entity,
      flashcardId: id,
      sessionId: id.optional(),
      reviewedAt: instant,
      rating: z.number().int().min(1).max(4),
      previousState: fsrsSchema,
      nextState: fsrsSchema,
      elapsedSeconds: z.number().nonnegative(),
      schedulerVersion: title,
    })
    .strict(),
  questions: z
    .object({
      ...entity,
      subjectId,
      topicIds,
      type: z.enum([
        "multiple choice",
        "true/false",
        "short answer",
        "long answer",
        "numeric",
        "programming",
        "essay",
        "custom",
      ]),
      prompt: z.string().min(1).max(10000),
      expectedAnswer: text,
      choices: z
        .array(z.object({ id, text: title }).strict())
        .max(20)
        .default([]),
      correctChoiceIds: ids.default([]),
      explanation: text.default(""),
      rubric: text.default(""),
      difficulty: level.default(3),
      hints: z.array(text).max(20).default([]),
      ...provenance,
      isGenerated: z.boolean().default(false),
    })
    .strict(),
  attempts: z
    .object({
      ...entity,
      questionId: id,
      sessionId: id.optional(),
      attemptedAt: instant,
      answer: text,
      grade: z.enum(["incorrect", "partial", "correct", "easy"]),
      score,
      elapsedSeconds: z.number().nonnegative(),
      usedHint: z.boolean(),
    })
    .strict(),
  masterySnapshots: z
    .object({
      ...entity,
      topicId: id,
      calculatedAt: instant,
      engineVersion: title,
      score,
      band: title,
      evidenceCount: z.number().nonnegative(),
      recall: score,
      practice: score,
      recency: score,
      confidence: score,
      reasons: z.array(text),
    })
    .strict(),
  readinessSnapshots: z
    .object({
      ...entity,
      examId: id,
      calculatedAt: instant,
      engineVersion: title,
      score,
      coverage: score,
      recall: score,
      practice: score,
      recency: score,
      remainingMinutes: minutes,
      weakestTopicIds: ids,
      reasons: z.array(text),
    })
    .strict(),
  studyPacks: z
    .object({
      ...entity,
      title,
      formatVersion: z.literal(1),
      sourceMetadata: text,
      references: text,
      relationships: text,
      subjectId,
    })
    .strict(),
  imports: z
    .object({
      ...entity,
      kind: z.literal("study-pack"),
      fileName: title,
      sourceFingerprint: title,
      formatVersion: z.literal(1),
      subjectId,
      createdIds: ids,
      warnings: z.array(text),
      status: z.literal("completed"),
    })
    .strict(),
  settings: z
    .object({
      ...entity,
      theme: z.enum(["system", "light", "dark"]).default("system"),
      locale: z.string().max(50).default("en"),
      weekStart: z.union([z.literal(0), z.literal(1)]).default(1),
      sessionMinutes: z.number().int().min(5).max(120).default(25),
      dailyLimit: z.number().int().min(15).max(720).default(180),
      onboardingDone: z.boolean().default(false),
      backupReminderDays: z.number().int().min(0).max(365).default(0),
      lastBackup: instant.optional(),
    })
    .strict(),
  appMeta: z
    .object({
      ...entity,
      dataVersion: z.literal(1),
      lastPlanDay: localDate.optional(),
      lastRestore: instant.optional(),
    })
    .strict(),
};
export type TableName = keyof typeof schemas;
export type Records = { [K in TableName]: z.output<(typeof schemas)[K]> };
export type Snapshot = { [K in TableName]: Records[K][] };
export type Subject = Records["subjects"];
export type Topic = Records["topics"];
export type Task = Records["tasks"];
export type Settings = Records["settings"];
export const tableNames = Object.keys(schemas) as TableName[];
export function identity(now = new Date().toISOString()) {
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}
export function defaultSettings(): Settings {
  return schemas.settings.parse({ ...identity(), id: "settings" });
}
