import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { today } from "../../engine/dates";
import { elapsedSeconds } from "../../engine/learning";
import { startSession, changeSession } from "./service";
import { replan } from "../planning/service";
import { CardReview } from "./FlashcardsPage";
import { QuestionPractice } from "./PracticePage";
import {
  Action,
  Empty,
  ErrorMessage,
  Loading,
} from "../../components/Feedback";
export default function StudyPage() {
  const [now, setNow] = useState(() => new Date().toISOString()),
    [mode, setMode] = useState<"recall" | "flashcards" | "practice">("recall"),
    [notes, setNotes] = useState(""),
    [rating, setRating] = useState(3);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { data, error } = useQuery(async () => {
    const session = await db
      .records("sessions")
      .where("state")
      .anyOf("active", "paused")
      .first();
    const items = session
      ? await db
          .records("sessionItems")
          .where("sessionId")
          .equals(session.id)
          .toArray()
      : [];
    const topicId = items[0]?.topicId;
    const cards = session
      ? await (
          session.subjectId
            ? db
                .records("flashcards")
                .where("subjectId")
                .equals(session.subjectId)
            : db.records("flashcards").toCollection()
        )
          .filter(
            (c) =>
              !c.isSuspended &&
              c.due <= new Date().toISOString() &&
              (!topicId || c.topicIds.includes(topicId)),
          )
          .limit(1)
          .toArray()
      : [];
    const questions = session
      ? await (
          session.subjectId
            ? db
                .records("questions")
                .where("subjectId")
                .equals(session.subjectId)
            : db.records("questions").toCollection()
        )
          .filter((q) => !topicId || q.topicIds.includes(topicId))
          .limit(30)
          .toArray()
      : [];
    const attempts = session
      ? await db
          .records("attempts")
          .where("sessionId")
          .equals(session.id)
          .toArray()
      : [];
    return {
      session,
      items,
      card: cards[0],
      question: questions.find(
        (q) => !attempts.some((a) => a.questionId === q.id),
      ),
      tasks: await db
        .records("tasks")
        .where("[scheduledDate+state]")
        .equals([today(), "planned"])
        .limit(30)
        .toArray(),
    };
  });
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  const session = data.session;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ONE THING AT A TIME</p>
          <h1>Time to focus.</h1>
          <p className="muted">Give your next step your full attention.</p>
        </div>
      </div>
      {session ? (
        <>
          <section className="focus-panel">
            <p className="eyebrow">
              {data.items[0]?.title ?? "Open study session"}
            </p>
            <div className="timer" aria-label="Elapsed focus time">
              {String(Math.floor(elapsedSeconds(session, now) / 60)).padStart(
                2,
                "0",
              )}
              <span>:</span>
              {String(Math.floor(elapsedSeconds(session, now) % 60)).padStart(
                2,
                "0",
              )}
            </div>
            <p className="muted">
              {session.state === "paused"
                ? "Paused · resume when you’re ready"
                : `${session.plannedMinutes} minute focus block`}
            </p>
            <div className="button-row">
              <Action
                onAction={() =>
                  changeSession(
                    session.id,
                    session.state === "active" ? "pause" : "resume",
                  )
                }
              >
                {session.state === "active" ? "Pause timer" : "Resume timer"}
              </Action>
              <Action
                className="primary"
                onAction={async () => {
                  await changeSession(session.id, "finish", notes, rating);
                  await replan("Study session completed");
                }}
              >
                Finish session
              </Action>
              <Action
                onAction={async () => {
                  if (
                    confirm(
                      "End this session without completing the task? Your learning results will remain saved.",
                    )
                  ) {
                    await changeSession(session.id, "abandon", notes);
                    await replan();
                  }
                }}
              >
                End early
              </Action>
            </div>
          </section>
          <nav className="tabs" aria-label="Session activity">
            {(["recall", "flashcards", "practice"] as const).map((value) => (
              <button
                className={mode === value ? "active" : ""}
                key={value}
                onClick={() => setMode(value)}
              >
                {value}
              </button>
            ))}
          </nav>
          {mode === "flashcards" ? (
            data.card ? (
              <CardReview
                key={`${data.card.id}:${data.card.updatedAt}`}
                card={data.card}
                sessionId={session.id}
              />
            ) : (
              <Empty title="No cards due for this session">
                <p>Switch to recall or practice, or add cards to this topic.</p>
                <Link to="/flashcards">Open flashcards</Link>
              </Empty>
            )
          ) : mode === "practice" ? (
            data.question ? (
              <QuestionPractice
                key={data.question.id}
                question={data.question}
                sessionId={session.id}
              />
            ) : (
              <Empty title="Practice complete for this session">
                <p>Try explaining the topic in your own words.</p>
              </Empty>
            )
          ) : (
            <section className="panel">
              <h2>Explain it without looking.</h2>
              <p className="muted">
                What are the key ideas? How do they connect? Write what you
                remember, then check your materials and fill in the gaps.
              </p>
              <label>
                Session notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={7}
                  placeholder="Start with what you remember…"
                />
              </label>
              <p className="small muted">
                Notes are saved when you finish or end the session.
              </p>
              <label>
                Focus rating
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}
        </>
      ) : (
        <section className="panel">
          <h2>Choose your next step</h2>
          {data.tasks.length ? (
            data.tasks.map((task) => (
              <div className="task-choice" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p className="muted">
                    {task.estimatedMinutes} min · {task.type}
                  </p>
                </div>
                <Action
                  className="primary"
                  onAction={() => startSession(task.id)}
                >
                  Start
                </Action>
              </div>
            ))
          ) : (
            <Empty title="A little independent study?">
              <p>
                You can start a focus session any time, or create a plan from
                your subjects.
              </p>
              <Action className="primary" onAction={() => startSession()}>
                Start a focus session
              </Action>
              <Link className="text-link" to="/subjects">
                Set up a study plan →
              </Link>
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
