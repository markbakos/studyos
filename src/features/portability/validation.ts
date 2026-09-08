import Ajv2020 from "ajv/dist/2020";
import { z } from "zod";
import { packSchema, type StudyPack } from "./pack-schema";
import { safeUrl, validateSnapshot } from "../../engine/integrity";
import { schemas, tableNames, identity } from "../../types/model";
import { newCardState } from "../../engine/learning";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false,
});
export const packJsonSchema = z.toJSONSchema(packSchema, {
  target: "draft-2020-12",
});
const validatePackShape = ajv.compile(packJsonSchema);
export const backupSchema = z
  .object({
    backupFormatVersion: z.literal(1),
    appVersion: z.string().max(50),
    dataVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    source: z.object({ app: z.literal("StudyOS") }).strict(),
    counts: z.record(z.string(), z.number().int().nonnegative()),
    payload: z
      .object({
        tables: z.record(z.string(), z.array(z.unknown()).max(200000)),
      })
      .strict(),
    digest: z
      .object({
        algorithm: z.literal("SHA-256"),
        value: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
  })
  .strict();
export const backupJsonSchema = {
  ...z.toJSONSchema(backupSchema, { target: "draft-2020-12" }),
  $defs: Object.fromEntries(
    tableNames.map((name) => [name, z.toJSONSchema(schemas[name])]),
  ),
};
const validateBackupShape = ajv.compile(backupJsonSchema);
export type Backup = z.infer<typeof backupSchema>;
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}
export async function digest(value: string | Uint8Array<ArrayBuffer>) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function packRows(
  pack: StudyPack,
  subjectId: string = crypto.randomUUID(),
) {
  const now = new Date().toISOString(),
    map = new Map<string, string>();
  for (const row of [
    pack.subject,
    ...pack.topics,
    ...pack.notes,
    ...pack.flashcards,
    ...pack.practiceQuestions,
  ])
    map.set(row.id, crypto.randomUUID());
  map.set(pack.subject.id, subjectId);
  const topicIds = (ids: string[]) =>
    ids.map((id) => {
      const target = map.get(id);
      if (!target) throw new Error(`Unknown topic ${id}`);
      return target;
    });
  const topics = pack.topics.map((t) =>
    schemas.topics.parse({
      ...identity(now),
      id: map.get(t.id),
      subjectId,
      title: t.title,
      description: t.description,
      parentTopicId: t.parentTopicId ? map.get(t.parentTopicId) : undefined,
      prerequisiteTopicIds: topicIds([
        ...new Set([
          ...t.prerequisiteTopicIds,
          ...pack.relationships
            .filter(
              (r) =>
                r.fromTopicId === t.id &&
                ["prerequisite", "builds-on"].includes(r.type),
            )
            .map((r) => r.toTopicId),
        ]),
      ]),
      difficulty: t.difficulty,
      importance: t.importance,
      estimatedMinutes: t.estimatedMinutes,
      position: t.position,
      sourceReferences: t.sourceReferences,
    }),
  );
  return {
    subjects: [
      schemas.subjects.parse({
        ...identity(now),
        id: subjectId,
        name: pack.subject.name,
        color: pack.subject.color,
        shortName: pack.subject.shortName,
        description: pack.subject.description,
        term: pack.subject.term,
      }),
    ],
    topics,
    notes: pack.notes.map((n) =>
      schemas.notes.parse({
        ...identity(now),
        ...n,
        id: map.get(n.id),
        subjectId,
        topicIds: topicIds(n.topicIds),
      }),
    ),
    flashcards: pack.flashcards.map((c) => {
      const state = newCardState(now);
      return schemas.flashcards.parse({
        ...identity(now),
        ...c,
        id: map.get(c.id),
        subjectId,
        topicIds: topicIds(c.topicIds),
        isGenerated: true,
        fsrsState: state,
        due: state.due,
      });
    }),
    questions: pack.practiceQuestions.map((q) =>
      schemas.questions.parse({
        ...identity(now),
        ...q,
        id: map.get(q.id),
        subjectId,
        topicIds: topicIds(q.topicIds),
        isGenerated: true,
      }),
    ),
  };
}
export function validatePack(input: unknown): StudyPack {
  if (!validatePackShape(input))
    throw new Error(
      ajv.errorsText(validatePackShape.errors, { separator: "\n" }),
    );
  const pack = packSchema.parse(input);
  const all = [
    pack.subject,
    ...pack.topics,
    ...pack.notes,
    ...pack.flashcards,
    ...pack.practiceQuestions,
    ...pack.references,
  ];
  if (new Set(all.map((r) => r.id)).size !== all.length)
    throw new Error("Pack IDs must be unique across all content.");
  const topics = new Set(pack.topics.map((t) => t.id)),
    refs = new Set(pack.references.map((r) => r.id));
  for (const row of [
    ...pack.topics,
    ...pack.notes,
    ...pack.flashcards,
    ...pack.practiceQuestions,
  ]) {
    for (const ref of row.sourceReferences)
      if (!refs.has(ref)) throw new Error(`Unknown source reference ${ref}`);
    if ("topicIds" in row)
      for (const id of row.topicIds)
        if (!topics.has(id)) throw new Error(`Unknown topic ${id}`);
    if (
      "parentTopicId" in row &&
      row.parentTopicId &&
      !topics.has(row.parentTopicId)
    )
      throw new Error("Unknown parent topic.");
  }
  for (const edge of pack.relationships)
    if (!topics.has(edge.fromTopicId) || !topics.has(edge.toTopicId))
      throw new Error("Unknown relationship topic.");
  for (const ref of pack.references)
    if (ref.url && !safeUrl(ref.url))
      throw new Error("Source URLs must use HTTP or HTTPS.");
  const empty = Object.fromEntries(tableNames.map((n) => [n, []]));
  validateSnapshot({ ...empty, ...packRows(pack) });
  return pack;
}
export async function validateBackup(input: unknown) {
  if (!validateBackupShape(input))
    throw new Error("Unsupported or malformed backup envelope.");
  const backup = backupSchema.parse(input);
  if ((await digest(canonical(backup.payload))) !== backup.digest.value)
    throw new Error(
      "Backup checksum does not match. Current data was not changed.",
    );
  const data = validateSnapshot(backup.payload.tables);
  if (
    Object.keys(backup.counts).length !== tableNames.length ||
    tableNames.some((n) => backup.counts[n] !== data[n].length)
  )
    throw new Error("Backup counts do not match its data.");
  for (const blob of data.materialBlobs) {
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = Uint8Array.from(atob(blob.base64), (c) => c.charCodeAt(0));
    } catch {
      throw new Error("Invalid stored material encoding.");
    }
    if (
      bytes.length !== blob.sizeBytes ||
      (await digest(bytes)) !== blob.checksum
    )
      throw new Error("Stored material checksum does not match.");
  }
  return { backup, data };
}
