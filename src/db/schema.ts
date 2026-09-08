import Dexie, { type Table } from "dexie";
import {
  schemas,
  tableNames,
  defaultSettings,
  identity,
  type Records,
  type TableName,
  type Snapshot,
} from "../types/model";

export const indexes: Record<TableName, string> = {
  subjects: "id,name,term,updatedAt",
  topics: "id,subjectId,parentTopicId,[subjectId+parentTopicId],updatedAt",
  exams: "id,subjectId,date,[subjectId+date]",
  examTopics: "id,examId,topicId,&[examId+topicId]",
  assignments: "id,subjectId,dueDate,status,[status+dueDate]",
  assignmentSubtasks: "id,assignmentId",
  availabilityRules: "id,weekday",
  availabilityExceptions: "id,date",
  calendarEvents: "id,startsAt,subjectId",
  notes: "id,subjectId,title,*topicIds",
  materials: "id,subjectId,title",
  materialBlobs: "id,&materialId",
  tasks:
    "id,scheduledDate,state,[scheduledDate+state],subjectId,topicId,planId,dueDate",
  plans: "id,generatedAt",
  planChanges: "id,createdAt",
  sessions: "id,state,startedAt,subjectId",
  sessionItems: "id,sessionId,studyTaskId",
  flashcards: "id,subjectId,due,*topicIds",
  reviews: "id,flashcardId,reviewedAt,sessionId",
  questions: "id,subjectId,*topicIds",
  attempts: "id,questionId,attemptedAt,sessionId",
  masterySnapshots: "id,topicId,calculatedAt",
  readinessSnapshots: "id,examId,calculatedAt",
  studyPacks: "id,subjectId",
  imports: "id,sourceFingerprint,createdAt",
  settings: "id",
  appMeta: "id",
};
export class StudyDatabase extends Dexie {
  constructor(name = "StudyOS") {
    super(name);
    this.version(1).stores(indexes);
  }
  records<K extends TableName>(name: K): Table<Records[K], string> {
    return this.table(name);
  }
}
export const db = new StudyDatabase();
export async function initialize(database = db) {
  await database.transaction(
    "rw",
    [database.table("settings"), database.table("appMeta")],
    async () => {
      if (!(await database.records("settings").get("settings")))
        await database.records("settings").add(defaultSettings());
      if (!(await database.records("appMeta").get("meta")))
        await database
          .records("appMeta")
          .add({ ...identity(), id: "meta", dataVersion: 1 });
    },
  );
}
export async function snapshot(database = db): Promise<Snapshot> {
  return database.transaction("r", database.tables, async () =>
    Object.fromEntries(
      await Promise.all(
        tableNames.map(async (name) => [
          name,
          await database.table(name).toArray(),
        ]),
      ),
    ),
  ) as Promise<Snapshot>;
}
export function parseRecord<K extends TableName>(
  name: K,
  value: unknown,
): Records[K] {
  return schemas[name].parse(value) as Records[K];
}
