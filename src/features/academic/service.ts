import { db, parseRecord, snapshot } from "../../db/schema";
import { identity, type TableName, type Records } from "../../types/model";
import { validateSnapshot } from "../../engine/integrity";

const editable = new Set<TableName>([
  "subjects",
  "topics",
  "exams",
  "examTopics",
  "assignments",
  "assignmentSubtasks",
  "availabilityRules",
  "availabilityExceptions",
  "calendarEvents",
  "notes",
  "materials",
  "settings",
  "questions",
  "flashcards",
]);
export async function saveRecord<K extends TableName>(
  name: K,
  input: unknown,
): Promise<Records[K]> {
  if (!editable.has(name)) throw new Error("History records cannot be edited.");
  return db.transaction("rw", db.tables, async () => {
    const row = parseRecord(name, input);
    const data = await snapshot();
    const existing = data[name].find((r) => r.id === row.id);
    if (existing) row.createdAt = existing.createdAt;
    row.updatedAt = new Date().toISOString();
    const list = data[name] as Records[K][];
    list.splice(0, list.length, ...list.filter((r) => r.id !== row.id), row);
    validateSnapshot(data);
    await db.records(name).put(row);
    return row;
  });
}
export async function removeInput(
  name:
    | "availabilityRules"
    | "availabilityExceptions"
    | "examTopics"
    | "assignmentSubtasks"
    | "calendarEvents",
  id: string,
) {
  await db.records(name).delete(id);
}
export async function createSubject(name: string) {
  return saveRecord("subjects", { ...identity(), name });
}
