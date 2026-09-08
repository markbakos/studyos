import { lazy, Suspense, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { identity, type Records } from "../../types/model";
import { saveRecord, removeInput } from "./service";
import { replan } from "../planning/service";
import { subjectFields } from "./SubjectsPage";
import { RecordForm, type Field } from "../../components/RecordForm";
import { Action, ErrorMessage, Loading } from "../../components/Feedback";
import * as Collection from "../../components/Collection";
const Notes = lazy(() => import("./NotesMaterials"));
type Kind = "topics" | "exams" | "assignments";
const level = (name: string, label: string): Field => ({
  name,
  label,
  type: "number",
  min: 1,
  max: 5,
  defaultValue: 3,
});
export default function SubjectPage() {
  const { id = "" } = useParams(),
    [params, setParams] = useSearchParams(),
    tab = params.get("tab") ?? "topics";
  const [editing, setEditing] = useState<
      | Records["topics"]
      | Records["exams"]
      | Records["assignments"]
      | "new"
      | null
    >(null),
    [editSubject, setEditSubject] = useState(false);
  const { data, error } = useQuery(
    async () => ({
      subject: await db.records("subjects").get(id),
      topics: await db
        .records("topics")
        .where("subjectId")
        .equals(id)
        .sortBy("position"),
      exams: await db
        .records("exams")
        .where("subjectId")
        .equals(id)
        .sortBy("date"),
      assignments: await db
        .records("assignments")
        .where("subjectId")
        .equals(id)
        .sortBy("dueDate"),
    }),
    [id],
  );
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  const subject = data.subject;
  if (!subject)
    return (
      <>
        <h1>Subject not found</h1>
        <Link to="/subjects">Back to subjects</Link>
      </>
    );
  const kind: Kind =
    tab === "exams"
      ? "exams"
      : tab === "assignments"
        ? "assignments"
        : "topics";
  const fields: Field[] = [
    { name: "title", label: "Title", required: true },
    ...(kind === "topics"
      ? [
          level("importance", "Importance (1–5)"),
          level("difficulty", "Difficulty (1–5)"),
          {
            name: "estimatedMinutes",
            label: "Estimated study minutes",
            type: "number" as const,
            min: 0,
            defaultValue: 120,
          },
          {
            name: "position",
            label: "Order",
            type: "number" as const,
            min: 0,
            defaultValue: data.topics.length,
          },
          {
            name: "parentTopicId",
            label: "Parent topic",
            type: "select" as const,
            options: [
              { value: "", label: "No parent" },
              ...data.topics
                .filter(
                  (t) =>
                    t.id !== (editing && editing !== "new" ? editing.id : ""),
                )
                .map((t) => ({ value: t.id, label: t.title })),
            ],
          },
          {
            name: "prerequisites",
            label: "Prerequisite topic IDs (comma separated)",
          },
        ]
      : kind === "exams"
        ? [
            {
              name: "date",
              label: "Exam date",
              type: "date" as const,
              required: true,
            },
            { name: "time", label: "Time (optional)", type: "time" as const },
            { name: "location", label: "Location" },
            level("importance", "Importance (1–5)"),
            level("difficulty", "Difficulty (1–5)"),
            {
              name: "targetReadiness",
              label: "Readiness target (0–1)",
              type: "number" as const,
              min: 0,
              max: 1,
              step: 0.05,
              defaultValue: 0.8,
            },
          ]
        : [
            {
              name: "dueDate",
              label: "Due date",
              type: "date" as const,
              required: true,
            },
            {
              name: "estimatedMinutes",
              label: "Estimated minutes",
              type: "number" as const,
              min: 1,
              defaultValue: 120,
            },
            level("priority", "Priority (1–5)"),
            {
              name: "progress",
              label: "Progress (0–1)",
              type: "number" as const,
              min: 0,
              max: 1,
              step: 0.05,
              defaultValue: 0,
            },
          ]),
    { name: "description", label: "Description", type: "textarea" },
  ];
  return (
    <>
      <Link className="back-link" to="/subjects">
        ← Subjects
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{subject.term || "YOUR LEARNING MAP"}</p>
          <h1>{subject.name}</h1>
          <p className="muted">
            {subject.description || "Build understanding, one topic at a time."}
            {subject.isArchived ? " · Archived" : ""}
          </p>
        </div>
        <div className="button-row">
          <Link className="button" to={`/create?subject=${id}`}>
            Create With AI
          </Link>
          <button onClick={() => setEditSubject(true)}>Edit subject</button>
          <Action
            onAction={async () => {
              await saveRecord("subjects", {
                ...subject,
                isArchived: !subject.isArchived,
              });
              await replan("Subject archive changed");
            }}
          >
            {subject.isArchived ? "Unarchive" : "Archive"}
          </Action>
        </div>
      </div>
      {editSubject ? (
        <section className="panel">
          <RecordForm
            fields={subjectFields}
            initial={subject}
            onCancel={() => setEditSubject(false)}
            onSave={async (values) => {
              await saveRecord("subjects", { ...subject, ...values });
              setEditSubject(false);
              await replan();
            }}
          />
        </section>
      ) : null}
      <nav className="tabs" aria-label="Subject sections">
        {["topics", "exams", "assignments", "notes"].map((name) => (
          <Link
            key={name}
            className={tab === name ? "active" : ""}
            to={`?tab=${name}`}
            onClick={() => setEditing(null)}
          >
            {name === "notes" ? "Notes & materials" : name}
          </Link>
        ))}
      </nav>
      {tab === "notes" ? (
        <Suspense fallback={<Loading />}>
          <Notes subjectId={id} topics={data.topics} />
        </Suspense>
      ) : (
        <section className="panel">
          <div className="section-heading">
            <h2>
              {kind === "topics"
                ? "What you’re learning"
                : kind === "exams"
                  ? "Your next milestones"
                  : "Work to hand in"}
            </h2>
            <button onClick={() => setEditing("new")}>
              + Add {kind.slice(0, -1)}
            </button>
          </div>
          {editing ? (
            <RecordForm
              key={editing === "new" ? "new" : editing.id}
              fields={fields}
              initial={
                editing === "new"
                  ? {}
                  : {
                      ...editing,
                      prerequisites:
                        "prerequisiteTopicIds" in editing
                          ? editing.prerequisiteTopicIds.join(", ")
                          : "",
                    }
              }
              onCancel={() => setEditing(null)}
              onSave={async (values) => {
                const { prerequisites, ...input } = values;
                if (kind === "topics") {
                  input.parentTopicId = input.parentTopicId || undefined;
                  input.prerequisiteTopicIds = String(prerequisites ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                }
                if (kind === "exams") input.time = input.time || undefined;
                if (kind === "assignments")
                  input.status = input.progress === 1 ? "completed" : "open";
                await saveRecord(kind, {
                  ...(editing === "new" ? identity() : editing),
                  subjectId: id,
                  ...input,
                });
                setEditing(null);
                await replan();
              }}
            />
          ) : null}
          <Collection.Root>
            <Collection.Search />
            <Collection.Items<Records[Kind]>
              items={data[kind]}
              text={(row) => row.title}
            >
              {(row) => (
                <article>
                  <div className="section-heading">
                    <div>
                      <h3>
                        {"parentTopicId" in row && row.parentTopicId
                          ? "↳ "
                          : ""}
                        {row.title}
                      </h3>
                      <p className="muted small">
                        {"date" in row
                          ? row.date
                          : "dueDate" in row
                            ? `${row.dueDate} · ${Math.round(row.progress * 100)}% complete`
                            : `${row.estimatedMinutes} min · difficulty ${row.difficulty}/5`}
                      </p>
                    </div>
                    <button onClick={() => setEditing(row)}>Edit</button>
                  </div>
                  {row.description ? (
                    <p className="small">{row.description}</p>
                  ) : null}
                  {kind === "topics" ? (
                    <div className="button-row small">
                      <Link to={`/flashcards?subject=${id}&topic=${row.id}`}>
                        Flashcards
                      </Link>
                      <Link to={`/practice?subject=${id}&topic=${row.id}`}>
                        Practice
                      </Link>
                      <span className="muted">ID: {row.id}</span>
                    </div>
                  ) : kind === "exams" ? (
                    <ExamCoverage examId={row.id} topics={data.topics} />
                  ) : (
                    <Subtasks assignmentId={row.id} />
                  )}
                </article>
              )}
            </Collection.Items>
          </Collection.Root>
          {kind === "exams" ? (
            <Action
              className="primary"
              onAction={async () => {
                await replan("Exam coverage updated");
                setParams({ tab: "exams" });
              }}
            >
              Build my plan
            </Action>
          ) : null}
        </section>
      )}
    </>
  );
}
function ExamCoverage({
  examId,
  topics,
}: {
  examId: string;
  topics: Records["topics"][];
}) {
  const { data: links = [] } = useQuery(
    () => db.records("examTopics").where("examId").equals(examId).toArray(),
    [examId],
  );
  return (
    <details>
      <summary>Exam topics & weights ({links.length})</summary>
      <p className="muted small">
        Choose the topics assessed. Higher weights receive more attention.
      </p>
      {topics.map((topic) => {
        const link = links.find((l) => l.topicId === topic.id);
        return (
          <div className="inline-row" key={topic.id}>
            <span>{topic.title}</span>
            {link ? (
              <>
                <label>
                  Weight{" "}
                  <input
                    aria-label={`${topic.title} weight`}
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={link.weight}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (value > 0 && value <= 100)
                        void saveRecord("examTopics", {
                          ...link,
                          weight: value,
                        })
                          .then(() => replan())
                          .catch(() => {
                            e.target.value = String(link.weight);
                          });
                    }}
                  />
                </label>
                <Action
                  onAction={async () => {
                    await removeInput("examTopics", link.id);
                    await replan();
                  }}
                >
                  Remove
                </Action>
              </>
            ) : (
              <Action
                onAction={async () => {
                  await saveRecord("examTopics", {
                    ...identity(),
                    examId,
                    topicId: topic.id,
                  });
                  await replan();
                }}
              >
                Include
              </Action>
            )}
          </div>
        );
      })}
    </details>
  );
}
function Subtasks({ assignmentId }: { assignmentId: string }) {
  const { data = [] } = useQuery(
      () =>
        db
          .records("assignmentSubtasks")
          .where("assignmentId")
          .equals(assignmentId)
          .toArray(),
      [assignmentId],
    ),
    [adding, setAdding] = useState(false);
  return (
    <details>
      <summary>
        Subtasks ({data.filter((s) => s.isComplete).length}/{data.length})
      </summary>
      {data.map((task) => (
        <div className="inline-row" key={task.id}>
          <span>
            {task.isComplete ? "✓ " : ""}
            {task.title}
          </span>
          <Action
            onAction={async () => {
              await saveRecord("assignmentSubtasks", {
                ...task,
                isComplete: !task.isComplete,
              });
              await replan();
            }}
          >
            {task.isComplete ? "Reopen" : "Complete"}
          </Action>
        </div>
      ))}
      <button onClick={() => setAdding(true)}>Add subtask</button>
      {adding ? (
        <RecordForm
          fields={[
            { name: "title", label: "Subtask title", required: true },
            {
              name: "estimatedMinutes",
              label: "Minutes",
              type: "number",
              min: 0,
              defaultValue: 25,
            },
          ]}
          onCancel={() => setAdding(false)}
          onSave={async (values) => {
            await saveRecord("assignmentSubtasks", {
              ...identity(),
              assignmentId,
              position: data.length,
              ...values,
            });
            setAdding(false);
            await replan();
          }}
        />
      ) : null}
    </details>
  );
}
