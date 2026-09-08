import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { identity, type Records } from "../../types/model";
import { newCardState } from "../../engine/learning";
import { saveRecord } from "../academic/service";
import { reviewCard } from "./service";
import { replan } from "../planning/service";
import { RecordForm } from "../../components/RecordForm";
import {
  Action,
  Empty,
  ErrorMessage,
  Loading,
} from "../../components/Feedback";
import * as Collection from "../../components/Collection";
export default function FlashcardsPage() {
  const [params] = useSearchParams(),
    subject = params.get("subject") ?? "",
    topic = params.get("topic") ?? "",
    review = params.get("mode") === "review";
  const [editing, setEditing] = useState<Records["flashcards"] | "new" | null>(
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
      cards: await (
        subject
          ? db.records("flashcards").where("subjectId").equals(subject)
          : db.records("flashcards").toCollection()
      )
        .filter((c) => !topic || c.topicIds.includes(topic))
        .toArray(),
    }),
    [subject, topic],
  );
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  const activeIds = new Set(data.subjects.map((s) => s.id)),
    focus = data.topics.find((item) => item.id === topic)?.title ?? "",
    due = data.cards
      .filter(
        (c) =>
          !c.isSuspended &&
          activeIds.has(c.subjectId) &&
          c.due <= new Date().toISOString(),
      )
      .sort((a, b) => a.due.localeCompare(b.due));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE IT STICK</p>
          <h1>Flashcards</h1>
          <p className="muted">
            Small moments of recall. Lasting understanding.
          </p>
        </div>
        <div className="button-row">
          <Link
            className="button"
            to={`/create?kind=flashcards&subject=${subject}&focus=${encodeURIComponent(focus)}`}
          >
            Create Batch With AI
          </Link>
          <button onClick={() => setEditing("new")}>+ Create Flashcard</button>
        </div>
      </div>
      <nav className="tabs">
        <Link
          className={!review ? "active" : ""}
          to={`/flashcards?subject=${subject}&topic=${topic}`}
        >
          Library
        </Link>
        <Link
          className={review ? "active" : ""}
          to={`/flashcards?mode=review&subject=${subject}&topic=${topic}`}
        >
          Review due ({due.length})
        </Link>
      </nav>
      {editing ? (
        <section className="panel">
          <RecordForm
            key={editing === "new" ? "new" : editing.id}
            initial={
              editing === "new"
                ? { subjectId: subject, topic }
                : { ...editing, topic: editing.topicIds[0] }
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
                label: "Topic (choose via subject for topic list)",
                type: "select",
                options: [
                  { value: "", label: "Whole subject" },
                  ...data.topics.map((t) => ({ value: t.id, label: t.title })),
                ],
              },
              {
                name: "type",
                label: "Card type",
                type: "select",
                options: [
                  "basic",
                  "reversible",
                  "cloze",
                  "typed",
                  "multiple choice",
                  "definition",
                  "code",
                ].map((value) => ({ value, label: value })),
              },
              {
                name: "front",
                label: "Front / question",
                type: "textarea",
                required: true,
              },
              {
                name: "back",
                label: "Back / answer",
                type: "textarea",
                required: true,
              },
              { name: "explanation", label: "Explanation", type: "textarea" },
            ]}
            onCancel={() => setEditing(null)}
            onSave={async (values) => {
              const { topic: selected, ...rest } = values,
                state = newCardState();
              await saveRecord("flashcards", {
                ...(editing === "new"
                  ? { ...identity(), fsrsState: state, due: state.due }
                  : editing),
                ...rest,
                topicIds: selected ? [selected] : [],
              });
              setEditing(null);
              await replan();
            }}
          />
        </section>
      ) : null}
      {review ? (
        due[0] ? (
          <CardReview key={`${due[0].id}:${due[0].updatedAt}`} card={due[0]} />
        ) : (
          <Empty title="You’re all caught up">
            <p>
              No cards are due. Come back at the next scheduled review, or add a
              new card.
            </p>
          </Empty>
        )
      ) : (
        <section className="panel">
          <Collection.Root>
            <Collection.Search />
            <Collection.Items items={data.cards} text={(c) => c.front}>
              {(card) => (
                <div className="section-heading">
                  <div>
                    <h3>{card.front}</h3>
                    <p className="muted small">
                      {card.type} ·{" "}
                      {card.isSuspended
                        ? "Suspended"
                        : `Due ${new Date(card.due).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="button-row">
                    <button onClick={() => setEditing(card)}>Edit</button>
                    <Action
                      onAction={() =>
                        saveRecord("flashcards", {
                          ...card,
                          isSuspended: !card.isSuspended,
                        })
                      }
                    >
                      {card.isSuspended ? "Resume" : "Suspend"}
                    </Action>
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
export function CardReview({
  card,
  sessionId,
}: {
  card: Records["flashcards"];
  sessionId?: string;
}) {
  const [revealed, setRevealed] = useState(false),
    [answer, setAnswer] = useState(""),
    [started] = useState(Date.now),
    [reverse] = useState(
      () => card.type === "reversible" && card.fsrsState.reps % 2 === 1,
    );
  return (
    <section className="review-card">
      <p className="eyebrow">RETRIEVAL PRACTICE · {card.type}</p>
      <h2 className="pre-wrap">{reverse ? card.back : card.front}</h2>
      {["typed", "cloze"].includes(card.type) ? (
        <label>
          Your answer
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
      ) : null}
      {revealed ? (
        <>
          <div className="answer pre-wrap">
            {reverse ? card.front : card.back}
          </div>
          {card.explanation ? (
            <p className="muted pre-wrap">{card.explanation}</p>
          ) : null}
          <p>How well did you remember?</p>
          <div className="rating-buttons">
            {([1, 2, 3, 4] as const).map((rating, i) => (
              <Action
                key={rating}
                onAction={async () => {
                  await reviewCard(
                    card.id,
                    rating,
                    card.updatedAt,
                    (Date.now() - started) / 1000,
                    sessionId,
                  );
                  await replan("Card review completed");
                }}
              >
                {["Again", "Hard", "Good", "Easy"][i]}
              </Action>
            ))}
          </div>
        </>
      ) : (
        <button className="primary" onClick={() => setRevealed(true)}>
          Reveal answer
        </button>
      )}
    </section>
  );
}
