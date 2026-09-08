import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import {
  db,
  initialize,
  snapshot,
  indexes,
  StudyDatabase,
} from "../src/db/schema";
import { identity, schemas, tableNames } from "../src/types/model";
import { saveRecord } from "../src/features/academic/service";
import { replan } from "../src/features/planning/service";
import {
  startSession,
  changeSession,
  reviewCard,
  answerQuestion,
} from "../src/features/learning/service";
import { capacityFor, generatePlan } from "../src/engine/planner";
import {
  newCardState,
  scheduleReview,
  gradeAnswer,
  elapsedSeconds,
} from "../src/engine/learning";
import { mastery } from "../src/engine/signals";
import { validateSnapshot } from "../src/engine/integrity";
import {
  canonical,
  digest,
  validatePack,
  validateBackup,
} from "../src/features/portability/validation";
import {
  createBackup,
  restoreBackup,
  importPack,
  exportPack,
} from "../src/features/portability/service";
import type { StudyPack } from "../src/features/portability/pack-schema";
import {
  createStudyPackPrompt,
  promptKinds,
} from "../src/features/generation/prompt";

const date = "2026-09-07",
  now = `${date}T12:00:00.000Z`;
beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  await initialize();
});
after(() => db.close());
async function fixture() {
  const subject = await saveRecord("subjects", {
    ...identity(now),
    name: "Algorithms",
  });
  const topic = await saveRecord("topics", {
    ...identity(now),
    subjectId: subject.id,
    title: "Dynamic programming",
    estimatedMinutes: 100,
  });
  const exam = await saveRecord("exams", {
    ...identity(now),
    subjectId: subject.id,
    title: "Algorithms exam",
    date: "2026-09-14",
  });
  await saveRecord("examTopics", {
    ...identity(now),
    examId: exam.id,
    topicId: topic.id,
    weight: 2,
  });
  for (let weekday = 0; weekday < 7; weekday++)
    await saveRecord("availabilityRules", {
      ...identity(now),
      weekday,
      startTime: "17:00",
      endTime: "18:00",
    });
  return { subject, topic, exam };
}
function packFixture(): StudyPack {
  return {
    formatVersion: 1,
    id: "pack",
    title: "Networks",
    subject: {
      id: "subject",
      name: "Networks",
      color: "#5268d9",
      learningObjectives: [],
    },
    topics: [
      {
        id: "topic",
        title: "TCP",
        description: "Reliable transport",
        learningObjectives: [],
        difficulty: 3,
        importance: 3,
        estimatedMinutes: 60,
        prerequisiteTopicIds: [],
        sourceReferences: ["ref"],
        position: 0,
      },
    ],
    notes: [
      {
        id: "note",
        title: "TCP summary",
        markdown: "**Reliable** transport",
        topicIds: ["topic"],
        sourceReferences: ["ref"],
      },
    ],
    flashcards: [
      {
        id: "card",
        type: "basic",
        topicIds: ["topic"],
        front: "What is TCP?",
        back: "A reliable transport protocol.",
        explanation: "",
        tags: [],
        sourceReferences: ["ref"],
      },
    ],
    practiceQuestions: [
      {
        id: "question",
        type: "numeric",
        topicIds: ["topic"],
        prompt: "How many bytes is a 16-bit value?",
        expectedAnswer: "2",
        choices: [],
        correctChoiceIds: [],
        explanation: "8 bits per byte.",
        rubric: "",
        hints: [],
        difficulty: 1,
        tags: [],
        sourceReferences: ["ref"],
      },
    ],
    relationships: [],
    references: [
      {
        id: "ref",
        title: "RFC 9293",
        kind: "specification",
        url: "https://www.rfc-editor.org/rfc/rfc9293.html",
      },
    ],
    metadata: {
      createdAt: now,
      language: "en",
      license: "User-authored example",
      sourceDescription: "RFC 9293",
    },
  };
}
test("fresh IndexedDB schema opens and preserves rows across reopen", async () => {
  assert.equal(db.verno, 1);
  assert.deepEqual(
    db.tables.map((t) => t.name).sort(),
    Object.keys(indexes).sort(),
  );
  await fixture();
  db.close();
  await db.open();
  assert.equal(await db.records("subjects").count(), 1);
});
test("capacity unions overlapping windows, applies exceptions and subtracts commitments", async () => {
  await fixture();
  await saveRecord("availabilityRules", {
    ...identity(),
    weekday: 1,
    startTime: "17:30",
    endTime: "19:00",
  });
  let data = await snapshot();
  assert.equal(capacityFor(date, data), 120);
  await saveRecord("availabilityExceptions", {
    ...identity(),
    date,
    mode: "remove",
    startTime: "18:00",
    endTime: "18:30",
  });
  data = await snapshot();
  assert.equal(capacityFor(date, data), 90);
  await saveRecord("availabilityExceptions", {
    ...identity(),
    date,
    mode: "cap",
    maxMinutes: 40,
  });
  assert.equal(capacityFor(date, await snapshot()), 40);
  await saveRecord("availabilityExceptions", {
    ...identity(),
    date,
    mode: "unavailable",
  });
  assert.equal(capacityFor(date, await snapshot()), 0);
});
test("planner is deterministic, capacity bounded and meets deadlines", async () => {
  await fixture();
  const data = await snapshot(),
    a = generatePlan(data, date),
    b = generatePlan(data, date);
  assert.deepEqual(a, b);
  assert.equal(a.shortfall, 0);
  assert(a.tasks.length > 0);
  for (const day of a.days) assert(day.allocated <= day.capacity);
  for (const task of a.tasks) {
    assert(task.estimatedMinutes > 0);
    assert(task.scheduledDate <= task.dueDate!);
    assert(task.scheduledDate >= date);
  }
});
test("zero availability and impossible same-day demands produce exact shortfall", async () => {
  const { exam } = await fixture();
  await db.records("availabilityRules").clear();
  const data = await snapshot(),
    plan = generatePlan(data, date);
  assert.equal(plan.tasks.length, 0);
  assert.equal(plan.shortfall, plan.requiredMinutes);
  await db.records("exams").update(exam.id, { date });
  assert(generatePlan(await snapshot(), date).shortfall > 0);
});
test("replanning is idempotent and keeps completed active and manual tasks", async () => {
  const { subject } = await fixture();
  const plan = await replan("initial", date);
  await replan("same", date);
  assert.equal(await db.records("plans").count(), 1);
  const tasks = await db.records("tasks").toArray();
  await db.records("tasks").update(tasks[0].id, { state: "completed" });
  await db.records("tasks").update(tasks[1].id, { state: "in progress" });
  const manual = schemas.tasks.parse({
    ...identity(),
    subjectId: subject.id,
    type: "custom",
    title: "Manual block",
    scheduledDate: date,
    estimatedMinutes: 10,
    priority: 1,
    isGenerated: false,
    explanation: "Personal task",
  });
  await db.records("tasks").add(manual);
  await replan("missed day", "2026-09-09");
  assert.equal(
    (await db.records("tasks").get(tasks[0].id))?.state,
    "completed",
  );
  assert.equal(
    (await db.records("tasks").get(tasks[1].id))?.state,
    "in progress",
  );
  assert.equal((await db.records("tasks").get(manual.id))?.scheduledDate, date);
  assert(await db.records("plans").get(plan.id));
  assert((await db.records("planChanges").count()) > 1);
});
test("hierarchy rejects cycles and cross-subject links atomically", async () => {
  const { topic, subject } = await fixture();
  const child = await saveRecord("topics", {
    ...identity(),
    subjectId: subject.id,
    title: "Child",
    parentTopicId: topic.id,
  });
  await assert.rejects(
    saveRecord("topics", { ...topic, parentTopicId: child.id }),
    /cycle/,
  );
  const other = await saveRecord("subjects", { ...identity(), name: "Other" });
  await assert.rejects(
    saveRecord("topics", {
      ...topic,
      subjectId: other.id,
      parentTopicId: child.id,
    }),
    /subject/,
  );
  assert.equal(
    (await db.records("topics").get(topic.id))?.parentTopicId,
    undefined,
  );
});
test("FSRS transitions, stale review prevention, evidence and objective grading", async () => {
  const { topic, subject } = await fixture();
  const state = newCardState(now);
  const card = await saveRecord("flashcards", {
    ...identity(now),
    subjectId: subject.id,
    topicIds: [topic.id],
    type: "basic",
    front: "Recall",
    back: "Answer",
    fsrsState: state,
    due: state.due,
  });
  assert.deepEqual(scheduleReview(card, 3, now), scheduleReview(card, 3, now));
  assert(scheduleReview(card, 3, now).state.reps > 0);
  await reviewCard(card.id, 3, card.updatedAt, 4);
  await assert.rejects(reviewCard(card.id, 3, card.updatedAt, 4), /changed/);
  assert.equal(await db.records("reviews").count(), 1);
  assert(mastery(topic, await snapshot(), new Date().toISOString()).score > 0);
  const q = await saveRecord("questions", {
    ...identity(),
    subjectId: subject.id,
    topicIds: [topic.id],
    type: "numeric",
    prompt: "2+2",
    expectedAnswer: "4",
  });
  assert.equal(gradeAnswer(q, ""), 0);
  assert.equal(gradeAnswer(q, "4"), 1);
  await answerQuestion(q.id, "4", 0, false, 2);
  assert.equal((await db.records("attempts").toArray())[0].score, 1);
});
test("session is unique, pause/reload timing is recoverable, finish is idempotent", async () => {
  await fixture();
  await replan("initial", date);
  const task = (await db.records("tasks").toArray())[0];
  const session = await startSession(task.id);
  assert.equal((await startSession(task.id)).id, session.id);
  await changeSession(session.id, "pause");
  const paused = (await db.records("sessions").get(session.id))!;
  assert.equal(
    elapsedSeconds(paused, "2099-01-01T00:00:00.000Z"),
    paused.elapsedSeconds,
  );
  await changeSession(session.id, "finish", "Recalled recurrence");
  await assert.rejects(changeSession(session.id, "finish"));
  assert.equal((await db.records("tasks").get(task.id))?.state, "completed");
});
test("valid content pack imports, duplicates block, exports and round-trips", async () => {
  const pack = validatePack(packFixture());
  await importPack(pack, "networks.study.json");
  assert.equal(await db.records("flashcards").count(), 1);
  await assert.rejects(importPack(pack, "same.json"), /already imported/);
  const subject = (await db.records("subjects").toArray())[0];
  const exported = await exportPack(subject.id);
  validatePack(exported);
  assert.equal(exported.notes.length, 1);
  assert.equal(exported.flashcards[0].front, pack.flashcards[0].front);
  await importPack(exported, "roundtrip.json");
  assert.equal(await db.records("subjects").count(), 2);
});
test("pack rejects unknown versions, properties, references, cycles and unsafe URLs", () => {
  for (const mutate of [
    (p: StudyPack) => {
      p.formatVersion = 2 as 1;
    },
    (p: StudyPack) => {
      p.topics[0].parentTopicId = "topic";
    },
    (p: StudyPack) => {
      p.references[0].url = "javascript:alert(1)";
    },
    (p: StudyPack) => {
      p.flashcards[0].topicIds = ["missing"];
    },
  ]) {
    const pack = packFixture();
    mutate(pack);
    assert.throws(() => validatePack(pack));
  }
  assert.throws(() => validatePack({ ...packFixture(), secret: "no" }));
});
test("AI prompt profiles include the exact import contract and task instructions", () => {
  for (const kind of promptKinds) {
    const prompt = createStudyPackPrompt({
      kind: kind.value,
      subject: "Algorithms",
      level: "University",
      goal: "Prepare for the final",
      topics: "Dynamic programming",
      sourceInstructions: "Use attached lecture.pdf",
      amount: "20 items",
      existingTopics: ["Recurrences"],
      language: "en",
      schema: { required: ["formatVersion", "flashcards"] },
    });
    assert.match(prompt, /Return exactly one raw JSON object/);
    assert.match(prompt, /Never invent/);
    assert.match(prompt, /Algorithms/);
    assert.match(prompt, /"flashcards"/);
    assert.match(prompt, new RegExp(kind.label.split(" ")[0], "i"));
  }
});
test("backup restores data and blobs; invalid digest and future format preserve database", async () => {
  await fixture();
  const backup = await createBackup(),
    original = await snapshot();
  await db
    .records("subjects")
    .update(original.subjects[0].id, { name: "Changed" });
  await restoreBackup(backup);
  assert.equal((await snapshot()).subjects[0].name, original.subjects[0].name);
  const before = canonical(await snapshot());
  await assert.rejects(
    restoreBackup({
      ...backup,
      digest: { algorithm: "SHA-256", value: "0".repeat(64) },
    }),
    /checksum/,
  );
  await assert.rejects(restoreBackup({ ...backup, backupFormatVersion: 99 }));
  assert.equal(canonical(await snapshot()), before);
  assert.equal((await validateBackup(backup)).data.topics.length, 1);
});
test("transaction failure rolls back import and restore", async () => {
  const fail = () => {
    throw new Error("injected write failure");
  };
  db.records("questions").hook("creating", fail);
  await assert.rejects(importPack(packFixture(), "test.json"), /injected/);
  db.records("questions").hook("creating").unsubscribe(fail);
  assert.equal(await db.records("subjects").count(), 0);
  await fixture();
  const backup = await createBackup();
  await db
    .records("subjects")
    .update((await snapshot()).subjects[0].id, { name: "Current" });
  db.records("topics").hook("creating", fail);
  await assert.rejects(restoreBackup(backup), /injected/);
  db.records("topics").hook("creating").unsubscribe(fail);
  assert.equal((await snapshot()).subjects[0].name, "Current");
});
test("empty backup and canonical digests round-trip", async () => {
  const backup = await createBackup();
  await restoreBackup(backup);
  assert.equal(await db.records("subjects").count(), 0);
  assert.equal(
    await digest(canonical({ b: 2, a: 1 })),
    await digest(canonical({ a: 1, b: 2 })),
  );
  validateSnapshot(await snapshot());
  assert.equal(tableNames.length, 27);
});
test("version-one migration harness reopens an existing fixture without deletion", async () => {
  const name = `migration-${crypto.randomUUID()}`,
    first = new StudyDatabase(name);
  await initialize(first);
  const subject = schemas.subjects.parse({ ...identity(), name: "Preserved" });
  await first.records("subjects").add(subject);
  first.close();
  const next = new StudyDatabase(name);
  await next.open();
  assert.deepEqual(await next.records("subjects").get(subject.id), subject);
  await next.delete();
});
