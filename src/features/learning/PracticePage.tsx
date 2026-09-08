import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { identity, type Records } from "../../types/model";
import { gradeAnswer } from "../../engine/learning";
import { saveRecord } from "../academic/service";
import { answerQuestion } from "./service";
import { replan } from "../planning/service";
import { RecordForm } from "../../components/RecordForm";
import { Action, ErrorMessage, Loading } from "../../components/Feedback";
import * as Collection from "../../components/Collection";
export default function PracticePage() {
  const [params] = useSearchParams(),
    subject = params.get("subject") ?? "",
    topic = params.get("topic") ?? "",
    selectedId = params.get("question");
  const [editing, setEditing] = useState<Records["questions"] | "new" | null>(
    null,
  );
  const { data, error } = useQuery(
    async () => ({
      subjects: await db
        .records("subjects")
        .filter((s) => !s.isArchived)
        .toArray(),
      topics: subject
        ? await db
            .records("topics")
            .where("subjectId")
            .equals(subject)
            .toArray()
        : [],
      questions: await (
        subject
          ? db.records("questions").where("subjectId").equals(subject)
          : db.records("questions").toCollection()
      )
        .filter((q) => !topic || q.topicIds.includes(topic))
        .toArray(),
    }),
    [subject, topic],
  );
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  const selected = data.questions.find((q) => q.id === selectedId),
    focus = data.topics.find((item) => item.id === topic)?.title ?? "";
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TURN KNOWLEDGE INTO UNDERSTANDING</p>
          <h1>Practice</h1>
          <p className="muted">Try it from memory. Learn from the answer.</p>
        </div>
        <div className="button-row">
          <Link
            className="button"
            to={`/create?kind=practice&subject=${subject}&focus=${encodeURIComponent(focus)}`}
          >
            Create Batch With AI
          </Link>
          <button onClick={() => setEditing("new")}>+ Create Question</button>
        </div>
      </div>
      {editing ? (
        <section className="panel">
          <RecordForm
            key={editing === "new" ? "new" : editing.id}
            initial={
              editing === "new"
                ? { subjectId: subject, topic }
                : {
                    ...editing,
                    topic: editing.topicIds[0],
                    choicesText: editing.choices.map((c) => c.text).join("\n"),
                    correct: editing.correctChoiceIds.join(","),
                    hintsText: editing.hints.join("\n"),
                  }
            }
            fields={[
              {
                name: "subjectId",
                label: "Subject",
                type: "select",
                required: true,
                options: data.subjects.map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
              },
              {
                name: "topic",
                label: "Topic",
                type: "select",
                options: [
                  { value: "", label: "Whole subject" },
                  ...data.topics.map((t) => ({ value: t.id, label: t.title })),
                ],
              },
              {
                name: "type",
                label: "Question type",
                type: "select",
                options: [
                  "short answer",
                  "multiple choice",
                  "true/false",
                  "numeric",
                  "long answer",
                  "programming",
                  "essay",
                  "custom",
                ].map((value) => ({ value, label: value })),
              },
              {
                name: "difficulty",
                label: "Difficulty (1–5)",
                type: "number",
                min: 1,
                max: 5,
                defaultValue: 3,
              },
              {
                name: "prompt",
                label: "Question",
                type: "textarea",
                required: true,
              },
              {
                name: "expectedAnswer",
                label: "Expected answer",
                type: "textarea",
                required: true,
              },
              {
                name: "choicesText",
                label: "Multiple choice options (one per line)",
                type: "textarea",
              },
              { name: "correct", label: "Correct option numbers (e.g. 1,3)" },
              {
                name: "hintsText",
                label: "Hints (one per line)",
                type: "textarea",
              },
              { name: "explanation", label: "Explanation", type: "textarea" },
              {
                name: "rubric",
                label: "Self-assessment rubric",
                type: "textarea",
              },
            ]}
            onCancel={() => setEditing(null)}
            onSave={async (values) => {
              const {
                topic: selected,
                choicesText,
                correct,
                hintsText,
                ...rest
              } = values;
              await saveRecord("questions", {
                ...(editing === "new" ? identity() : editing),
                ...rest,
                topicIds: selected ? [selected] : [],
                choices: String(choicesText)
                  .split("\n")
                  .filter(Boolean)
                  .map((text, i) => ({ id: String(i + 1), text })),
                correctChoiceIds: String(correct)
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                hints: String(hintsText).split("\n").filter(Boolean),
              });
              setEditing(null);
            }}
          />
        </section>
      ) : null}
      {selected ? (
        <>
          <Link to={`/practice?subject=${subject}&topic=${topic}`}>
            ← Question library
          </Link>
          <QuestionPractice key={selected.id} question={selected} />
        </>
      ) : (
        <section className="panel">
          <Collection.Root>
            <Collection.Search />
            <Collection.Items items={data.questions} text={(q) => q.prompt}>
              {(q) => (
                <div className="section-heading">
                  <div>
                    <h3>{q.prompt}</h3>
                    <p className="muted small">
                      {q.type} · difficulty {q.difficulty}/5
                    </p>
                  </div>
                  <div className="button-row">
                    <Link
                      className="button primary"
                      to={`/practice?subject=${subject}&topic=${topic}&question=${q.id}`}
                    >
                      Practice
                    </Link>
                    <button onClick={() => setEditing(q)}>Edit</button>
                  </div>
                </div>
              )}
            </Collection.Items>
          </Collection.Root>
        </section>
      )}
    </>
  );
}
export function QuestionPractice({
  question,
  sessionId,
}: {
  question: Records["questions"];
  sessionId?: string;
}) {
  const [answer, setAnswer] = useState(""),
    [revealed, setRevealed] = useState(false),
    [hint, setHint] = useState(false),
    [saved, setSaved] = useState(false),
    [started] = useState(Date.now);
  const objective = gradeAnswer(question, answer);
  return (
    <section className="review-card">
      <p className="eyebrow">
        {question.type} · DIFFICULTY {question.difficulty}/5
      </p>
      <h2 className="pre-wrap">{question.prompt}</h2>
      {question.type === "multiple choice" ? (
        <fieldset disabled={revealed}>
          <legend>Select all correct answers</legend>
          {question.choices.map((choice) => (
            <label className="choice" key={choice.id}>
              <input
                type="checkbox"
                checked={answer.split(",").includes(choice.id)}
                onChange={(e) =>
                  setAnswer(
                    e.target.checked
                      ? [...answer.split(",").filter(Boolean), choice.id].join(
                          ",",
                        )
                      : answer
                          .split(",")
                          .filter((id) => id !== choice.id)
                          .join(","),
                  )
                }
              />
              {choice.text}
            </label>
          ))}
        </fieldset>
      ) : (
        <label>
          Your answer
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            disabled={revealed}
          />
        </label>
      )}
      {question.hints.length ? (
        <>
          <button onClick={() => setHint(true)}>Show a hint</button>
          {hint ? <p className="notice">{question.hints.join("\n")}</p> : null}
        </>
      ) : null}
      {revealed ? (
        <>
          <div className="answer pre-wrap">{question.expectedAnswer}</div>
          <p className="pre-wrap">{question.explanation}</p>
          <p className="muted">{question.rubric}</p>
          {saved ? (
            <p role="status">
              Attempt saved. Your learning evidence is updated.
            </p>
          ) : (
            <>
              <p>
                {objective === undefined
                  ? "Assess your answer against the explanation."
                  : objective === 1
                    ? "Correct answer."
                    : "There’s something to revisit."}
              </p>
              <div className="rating-buttons">
                {(objective === undefined ? [0, 0.5, 1] : [objective]).map(
                  (score) => (
                    <Action
                      key={score}
                      onAction={async () => {
                        await answerQuestion(
                          question.id,
                          answer,
                          score,
                          hint,
                          (Date.now() - started) / 1000,
                          sessionId,
                        );
                        setSaved(true);
                        await replan("Practice completed");
                      }}
                    >
                      {objective === undefined
                        ? score === 0
                          ? "Incorrect"
                          : score === 0.5
                            ? "Partly correct"
                            : "Correct"
                        : "Save result"}
                    </Action>
                  ),
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <button
          className="primary"
          disabled={!answer.trim()}
          onClick={() => setRevealed(true)}
        >
          Check answer
        </button>
      )}
    </section>
  );
}
