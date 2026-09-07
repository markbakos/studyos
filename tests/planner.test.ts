import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePlan, PLANNER_VERSION } from "../src/engine/planner";
import { db, initialize } from "../src/db/schema";
import { replan } from "../src/features/planning/service";
import { schemas, tableNames, type Snapshot } from "../src/types/model";

const date = "2026-09-07";
const entity = (id: string) => ({
  id,
  createdAt: `${date}T12:00:00.000Z`,
  updatedAt: `${date}T12:00:00.000Z`,
});
function fixture(): Snapshot {
  const data = Object.fromEntries(
    tableNames.map((name) => [name, []]),
  ) as Snapshot;
  data.subjects.push(
    schemas.subjects.parse({ ...entity("subject"), name: "Algorithms" }),
  );
  data.topics.push(
    schemas.topics.parse({
      ...entity("topic"),
      subjectId: "subject",
      title: "Recursion",
      estimatedMinutes: 100,
    }),
  );
  data.exams.push(
    schemas.exams.parse({
      ...entity("exam"),
      subjectId: "subject",
      title: "Algorithms exam",
      date: "2026-09-10",
    }),
  );
  data.examTopics.push(
    schemas.examTopics.parse({
      ...entity("coverage"),
      examId: "exam",
      topicId: "topic",
      estimatedMinutes: 100,
    }),
  );
  for (let weekday = 0; weekday < 7; weekday++) {
    data.availabilityRules.push(
      schemas.availabilityRules.parse({
        ...entity(`day-${weekday}`),
        weekday,
        startTime: "17:00",
        endTime: "19:00",
      }),
    );
  }
  return data;
}

test("exam study revisits a topic across available days without mutating input", () => {
  const data = fixture(),
    before = structuredClone(data);
  const plan = generatePlan(data, date);
  assert.equal(plan.shortfall, 0);
  assert.deepEqual(
    plan.tasks.map((task) => task.scheduledDate),
    [date, "2026-09-08", "2026-09-09", "2026-09-10"],
  );
  assert.equal(
    plan.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
    100,
  );
  assert(
    plan.tasks.every((task) => task.explanation.includes("spread across")),
  );
  assert.deepEqual(generatePlan(data, date), plan);
  assert.deepEqual(data, before);
});

test("same-day exams and unavailable future days retain usable capacity", () => {
  for (const sameDay of [true, false]) {
    const data = fixture();
    if (sameDay) data.exams[0].date = date;
    else
      data.availabilityRules = data.availabilityRules.filter(
        (rule) => rule.weekday === 1,
      );
    const plan = generatePlan(data, date);
    assert.equal(plan.shortfall, 0);
    assert(plan.tasks.every((task) => task.scheduledDate === date));
    assert.equal(plan.days[0].allocated, 100);
  }
});

test("spacing yields to assignment contention rather than inventing a shortfall", () => {
  const data = fixture();
  data.exams[0].date = "2026-09-08";
  data.assignments.push(
    schemas.assignments.parse({
      ...entity("assignment"),
      subjectId: "subject",
      title: "Problem set",
      dueDate: "2026-09-08",
      estimatedMinutes: 60,
    }),
  );
  data.availabilityExceptions.push(
    schemas.availabilityExceptions.parse({
      ...entity("cap-today"),
      date,
      mode: "cap",
      maxMinutes: 100,
    }),
    schemas.availabilityExceptions.parse({
      ...entity("cap-tomorrow"),
      date: "2026-09-08",
      mode: "cap",
      maxMinutes: 60,
    }),
  );
  const plan = generatePlan(data, date);
  assert.equal(plan.shortfall, 0);
  assert.equal(plan.requiredMinutes, 160);
  assert(plan.days.every((day) => day.allocated + day.locked <= day.capacity));
  assert(plan.tasks.every((task) => task.scheduledDate <= task.dueDate!));
});

test("prerequisite work precedes dependent work and impossible demand stays explicit", () => {
  const data = fixture();
  data.topics.push(
    schemas.topics.parse({
      ...entity("dependent"),
      subjectId: "subject",
      title: "Dynamic programming",
      prerequisiteTopicIds: ["topic"],
    }),
  );
  data.examTopics.push(
    schemas.examTopics.parse({
      ...entity("dependent-coverage"),
      examId: "exam",
      topicId: "dependent",
      estimatedMinutes: 50,
    }),
  );
  const plan = generatePlan(data, date);
  assert.equal(plan.shortfall, 0);
  const firstDependent = plan.tasks.findIndex(
    (task) => task.topicId === "dependent",
  );
  assert.equal(
    plan.tasks
      .slice(0, firstDependent)
      .reduce((sum, task) => sum + task.estimatedMinutes, 0),
    100,
  );
  data.availabilityRules = [];
  const impossible = generatePlan(data, date);
  assert.equal(impossible.status, "infeasible");
  assert.equal(impossible.shortfall, 150);
  assert.equal(impossible.tasks.length, 0);
});

test("practice content changes regenerate the plan; unchanged inputs preserve it", async () => {
  try {
    await initialize();
    const data = fixture();
    await db.transaction("rw", db.tables, async () => {
      for (const name of tableNames) {
        if (data[name].length) await db.table(name).bulkAdd(data[name]);
      }
    });
    const initial = await replan("Initial plan", date);
    assert.equal(initial.algorithmVersion, PLANNER_VERSION);
    await db.records("questions").add(
      schemas.questions.parse({
        ...entity("question"),
        subjectId: "subject",
        topicIds: ["topic"],
        type: "short answer",
        prompt: "Explain recursion",
        expectedAnswer: "A function calls itself",
      }),
    );
    const updated = await replan("Practice available", date);
    assert.notEqual(updated.id, initial.id);
    const tasks = await db
      .records("tasks")
      .where("planId")
      .equals(updated.id)
      .toArray();
    assert(tasks.length > 0);
    assert(tasks.every((task) => task.type === "practice"));
    assert.equal((await replan("Unchanged", date)).id, updated.id);
    assert.equal(await db.records("plans").count(), 2);
  } finally {
    await db.delete();
  }
});
