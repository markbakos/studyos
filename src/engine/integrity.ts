import {
  schemas,
  tableNames,
  type Snapshot,
  type TableName,
} from "../types/model";
export function safeUrl(value: string) {
  if (!value) return true;
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function validateSnapshot(input: unknown): Snapshot {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected a table snapshot.");
  const source = input as Record<string, unknown>;
  if (Object.keys(source).length !== tableNames.length)
    throw new Error("Backup must include exactly the supported tables.");
  const data = Object.fromEntries(
    tableNames.map((name) => [
      name,
      schemas[name].array().max(200000).parse(source[name]),
    ]),
  ) as Snapshot;
  for (const name of tableNames)
    if (new Set(data[name].map((row) => row.id)).size !== data[name].length)
      throw new Error(`Duplicate IDs in ${name}.`);
  const maps = new Map(
    tableNames.map((name) => [name, new Set(data[name].map((row) => row.id))]),
  );
  const requireRef = (table: TableName, id: string | undefined) => {
    if (id && !maps.get(table)?.has(id))
      throw new Error(`Missing ${table} reference: ${id}`);
  };
  const fields: Record<string, TableName> = {
    subjectId: "subjects",
    parentTopicId: "topics",
    topicId: "topics",
    examId: "exams",
    assignmentId: "assignments",
    planId: "plans",
    toPlanId: "plans",
    fromPlanId: "plans",
    sessionId: "sessions",
    studyTaskId: "tasks",
    flashcardId: "flashcards",
    questionId: "questions",
    materialId: "materials",
    blobId: "materialBlobs",
  };
  for (const name of tableNames)
    for (const row of data[name]) {
      for (const [field, value] of Object.entries(row)) {
        if (fields[field] && typeof value === "string")
          requireRef(fields[field], value);
        if (
          ["topicIds", "prerequisiteTopicIds", "weakestTopicIds"].includes(
            field,
          ) &&
          Array.isArray(value)
        )
          for (const id of value) requireRef("topics", id);
        if (field === "sourceMaterialIds" && Array.isArray(value))
          for (const id of value) requireRef("materials", id);
        if (field === "url" && typeof value === "string" && !safeUrl(value))
          throw new Error("Only HTTP and HTTPS material links are supported.");
      }
      if ("subjectId" in row && row.subjectId) {
        const topicIds =
          "topicIds" in row
            ? row.topicIds
            : "topicId" in row && row.topicId
              ? [row.topicId]
              : [];
        for (const id of topicIds)
          if (data.topics.find((t) => t.id === id)?.subjectId !== row.subjectId)
            throw new Error("Topics must belong to the same subject.");
      }
    }
  const topics = new Map(data.topics.map((t) => [t.id, t]));
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id))
      throw new Error("Topic hierarchy or prerequisites contain a cycle.");
    if (visited.has(id)) return;
    const topic = topics.get(id)!;
    visiting.add(id);
    for (const parentId of [
      ...topic.prerequisiteTopicIds,
      ...(topic.parentTopicId ? [topic.parentTopicId] : []),
    ]) {
      const parent = topics.get(parentId);
      if (!parent || parent.subjectId !== topic.subjectId)
        throw new Error(
          "Topic relationships must remain inside their subject.",
        );
      visit(parentId);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const topic of data.topics) visit(topic.id);
  for (const link of data.examTopics)
    if (
      data.exams.find((e) => e.id === link.examId)?.subjectId !==
      topics.get(link.topicId)?.subjectId
    )
      throw new Error("Exam topics must belong to the exam subject.");
  if (
    new Set(data.examTopics.map((l) => `${l.examId}:${l.topicId}`)).size !==
    data.examTopics.length
  )
    throw new Error("Duplicate exam topic.");
  for (const rule of data.availabilityRules)
    if (rule.endTime <= rule.startTime)
      throw new Error(
        "Availability must end after it starts; split overnight windows.",
      );
  for (const exception of data.availabilityExceptions) {
    if (
      ["add", "remove"].includes(exception.mode) &&
      (!exception.startTime ||
        !exception.endTime ||
        exception.endTime <= exception.startTime)
    )
      throw new Error("Choose a valid exception window.");
    if (exception.mode === "cap" && exception.maxMinutes === undefined)
      throw new Error("Day caps require minutes.");
  }
  for (const event of data.calendarEvents)
    if (event.endsAt <= event.startsAt)
      throw new Error("Events must end after they start.");
  for (const q of data.questions) {
    if (
      q.type === "multiple choice" &&
      (q.choices.length < 2 ||
        !q.correctChoiceIds.length ||
        q.correctChoiceIds.some((id) => !q.choices.some((c) => c.id === id)))
    )
      throw new Error(
        "Multiple choice questions need choices and valid correct answers.",
      );
    if (new Set(q.choices.map((c) => c.id)).size !== q.choices.length)
      throw new Error("Duplicate choice IDs.");
    if (q.type === "numeric" && !Number.isFinite(Number(q.expectedAnswer)))
      throw new Error("Numeric answers must be finite numbers.");
    if (
      q.type === "true/false" &&
      !["true", "false"].includes(q.expectedAnswer.toLowerCase())
    )
      throw new Error("Use true or false as the expected answer.");
  }
  if (
    data.settings.length > 1 ||
    data.settings.some((s) => s.id !== "settings")
  )
    throw new Error("Invalid settings singleton.");
  if (data.appMeta.length > 1 || data.appMeta.some((s) => s.id !== "meta"))
    throw new Error("Invalid metadata singleton.");
  return data;
}
