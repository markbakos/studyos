import { db, snapshot } from "../../db/schema";
import { identity, tableNames, type Snapshot } from "../../types/model";
import { validateSnapshot } from "../../engine/integrity";
import {
  canonical,
  digest,
  packRows,
  validateBackup,
  validatePack,
} from "./validation";
import type { StudyPack } from "./pack-schema";
import { elapsedSeconds } from "../../engine/learning";

export function download(content: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function createBackup() {
  const tables = await snapshot(),
    payload = { tables };
  const backup = {
    backupFormatVersion: 1,
    appVersion: "1.0.0",
    dataVersion: 1,
    exportedAt: new Date().toISOString(),
    source: { app: "StudyOS" },
    counts: Object.fromEntries(tableNames.map((n) => [n, tables[n].length])),
    payload,
    digest: { algorithm: "SHA-256", value: await digest(canonical(payload)) },
  };
  await validateBackup(backup);
  return backup;
}
export async function exportBackup() {
  const backup = await createBackup();
  download(
    JSON.stringify(backup),
    `studyos-backup-${backup.exportedAt.slice(0, 10)}.studyos`,
  );
  await db
    .records("settings")
    .update("settings", { lastBackup: backup.exportedAt });
  return backup.digest.value;
}
export async function restoreBackup(input: unknown) {
  const { data } = await validateBackup(input);
  const now = new Date().toISOString();
  await db.transaction("rw", db.tables, async () => {
    for (const name of tableNames) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(data[name]);
    }
    for (const session of data.sessions.filter((s) => s.state === "active"))
      await db
        .records("sessions")
        .update(session.id, {
          state: "paused",
          elapsedSeconds: elapsedSeconds(
            session,
            input && typeof input === "object" && "exportedAt" in input
              ? String(input.exportedAt)
              : now,
          ),
          runningSince: undefined,
        });
    await db
      .records("appMeta")
      .put({ ...identity(now), id: "meta", dataVersion: 1, lastRestore: now });
    for (const name of tableNames.filter((n) => n !== "appMeta"))
      if ((await db.table(name).count()) !== data[name].length)
        throw new Error(`Restore count mismatch in ${name}.`);
  });
}
const normalized = (s: string) =>
  s.trim().toLocaleLowerCase().replace(/\s+/g, " ");
export async function importPack(
  input: StudyPack,
  fileName: string,
  targetId?: string,
  separateCopy = false,
) {
  const pack = validatePack(input),
    fingerprint = await digest(canonical(pack));
  return db.transaction("rw", db.tables, async () => {
    if (
      !separateCopy &&
      (await db
        .records("imports")
        .where("sourceFingerprint")
        .equals(fingerprint)
        .count())
    )
      throw new Error(
        "This exact pack was already imported. Choose a separate copy to import again.",
      );
    const data = await snapshot(),
      rows = packRows(pack, targetId);
    const subjectId = rows.subjects[0].id;
    if (targetId && !data.subjects.some((s) => s.id === targetId))
      throw new Error("Target subject no longer exists.");
    const remap = new Map<string, string>();
    if (!separateCopy)
      for (const topic of rows.topics) {
        const parent = topic.parentTopicId
          ? (remap.get(topic.parentTopicId) ?? topic.parentTopicId)
          : undefined;
        const existing = data.topics.find(
          (t) =>
            t.subjectId === subjectId &&
            t.parentTopicId === parent &&
            normalized(t.title) === normalized(topic.title),
        );
        if (existing) remap.set(topic.id, existing.id);
      }
    rows.topics = rows.topics
      .filter((t) => !remap.has(t.id))
      .map((t) => ({
        ...t,
        parentTopicId: t.parentTopicId
          ? (remap.get(t.parentTopicId) ?? t.parentTopicId)
          : undefined,
        prerequisiteTopicIds: t.prerequisiteTopicIds.map(
          (id) => remap.get(id) ?? id,
        ),
      }));
    for (const kind of ["notes", "flashcards", "questions"] as const)
      for (const row of rows[kind])
        row.topicIds = row.topicIds.map((id) => remap.get(id) ?? id);
    if (!separateCopy) {
      rows.flashcards = rows.flashcards.filter(
        (c) =>
          !data.flashcards.some(
            (old) =>
              old.subjectId === subjectId &&
              old.type === c.type &&
              normalized(old.front) === normalized(c.front),
          ),
      );
      rows.questions = rows.questions.filter(
        (q) =>
          !data.questions.some(
            (old) =>
              old.subjectId === subjectId &&
              old.type === q.type &&
              normalized(old.prompt) === normalized(q.prompt),
          ),
      );
    }
    const createdIds: string[] = [];
    for (const kind of [
      "subjects",
      "topics",
      "notes",
      "flashcards",
      "questions",
    ] as const) {
      if (kind === "subjects" && targetId) continue;
      await db.table(kind).bulkAdd(rows[kind]);
      createdIds.push(...rows[kind].map((r) => r.id));
    }
    validateSnapshot(await snapshot());
    await db
      .records("studyPacks")
      .add({
        ...identity(),
        title: pack.title,
        formatVersion: 1,
        subjectId,
        sourceMetadata: JSON.stringify(pack.metadata),
        references: JSON.stringify(pack.references),
        relationships: JSON.stringify(pack.relationships),
      });
    await db
      .records("imports")
      .add({
        ...identity(),
        kind: "study-pack",
        fileName,
        sourceFingerprint: fingerprint,
        formatVersion: 1,
        subjectId,
        createdIds,
        warnings: [],
        status: "completed",
      });
    return { subjectId, count: createdIds.length };
  });
}
export async function exportPack(subjectId: string, rootTopicId?: string) {
  const data = await snapshot(),
    subject = data.subjects.find((s) => s.id === subjectId);
  if (!subject) throw new Error("Choose a subject to export.");
  const included = new Set<string>();
  if (rootTopicId) {
    included.add(rootTopicId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of data.topics)
        if (
          t.parentTopicId &&
          included.has(t.parentTopicId) &&
          !included.has(t.id)
        ) {
          included.add(t.id);
          changed = true;
        }
    }
  }
  const topics = data.topics.filter(
    (t) => t.subjectId === subjectId && (!rootTopicId || included.has(t.id)),
  );
  const topicSet = new Set(topics.map((t) => t.id));
  const hasTopics = (row: { subjectId: string; topicIds: string[] }) =>
    row.subjectId === subjectId &&
    (!rootTopicId || row.topicIds.some((id) => topicSet.has(id)));
  const all = [
    subject,
    ...topics,
    ...data.notes.filter(hasTopics),
    ...data.flashcards.filter(hasTopics),
    ...data.questions.filter(hasTopics),
  ];
  const map = new Map(all.map((row) => [row.id, crypto.randomUUID()]));
  const refs = data.studyPacks
    .filter((p) => p.subjectId === subjectId)
    .flatMap((p) => JSON.parse(p.references) as StudyPack["references"]);
  const references = [...new Map(refs.map((r) => [r.id, r])).values()];
  const sourceIds = new Set(references.map((r) => r.id));
  const content = (
    row: Snapshot["flashcards"][number] | Snapshot["questions"][number],
  ) => ({
    id: map.get(row.id)!,
    topicIds: row.topicIds
      .filter((id) => topicSet.has(id))
      .map((id) => map.get(id)!),
    tags: row.tags,
    sourceReferences: row.sourceReferences.filter((id) => sourceIds.has(id)),
  });
  const pack: StudyPack = {
    formatVersion: 1,
    id: crypto.randomUUID(),
    title: subject.name,
    subject: {
      id: map.get(subject.id)!,
      name: subject.name,
      color: subject.color,
      description: subject.description,
      shortName: subject.shortName,
      term: subject.term,
      learningObjectives: [],
    },
    topics: topics.map((t) => ({
      id: map.get(t.id)!,
      title: t.title,
      description: t.description,
      parentTopicId:
        t.parentTopicId && topicSet.has(t.parentTopicId)
          ? map.get(t.parentTopicId)
          : undefined,
      learningObjectives: [],
      difficulty: t.difficulty,
      importance: t.importance,
      estimatedMinutes: t.estimatedMinutes,
      prerequisiteTopicIds: t.prerequisiteTopicIds
        .filter((id) => topicSet.has(id))
        .map((id) => map.get(id)!),
      sourceReferences: t.sourceReferences.filter((id) => sourceIds.has(id)),
      position: t.position,
    })),
    notes: data.notes
      .filter(hasTopics)
      .map((n) => ({
        id: map.get(n.id)!,
        title: n.title,
        markdown: n.markdown,
        topicIds: n.topicIds
          .filter((id) => topicSet.has(id))
          .map((id) => map.get(id)!),
        sourceReferences: n.sourceReferences.filter((id) => sourceIds.has(id)),
      })),
    flashcards: data.flashcards
      .filter(hasTopics)
      .map((c) => ({
        ...content(c),
        type: c.type,
        front: c.front,
        back: c.back,
        explanation: c.explanation,
      })),
    practiceQuestions: data.questions
      .filter(hasTopics)
      .map((q) => ({
        ...content(q),
        type: q.type,
        prompt: q.prompt,
        expectedAnswer: q.expectedAnswer,
        choices: q.choices,
        correctChoiceIds: q.correctChoiceIds,
        explanation: q.explanation,
        rubric: q.rubric,
        hints: q.hints,
        difficulty: q.difficulty,
      })),
    relationships: topics.flatMap((t) =>
      t.prerequisiteTopicIds
        .filter((id) => topicSet.has(id))
        .map((id) => ({
          fromTopicId: map.get(t.id)!,
          toTopicId: map.get(id)!,
          type: "prerequisite" as const,
        })),
    ),
    references,
    metadata: {
      createdAt: new Date().toISOString(),
      language: "en",
      license: "User-owned content; verify rights before sharing.",
      sourceDescription: "Exported from StudyOS.",
    },
  };
  validatePack(pack);
  return pack;
}
