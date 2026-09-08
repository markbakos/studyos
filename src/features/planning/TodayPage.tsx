import { Link, useNavigate } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { today, displayDate, daysBetween } from "../../engine/dates";
import { replan } from "./service";
import { startSession } from "../learning/service";
import {
  Action,
  Empty,
  ErrorMessage,
  Loading,
} from "../../components/Feedback";
export default function TodayPage() {
  const date = today(),
    navigate = useNavigate();
  const { data, error } = useQuery(async () => {
    const [subjects, tasks, exam, dueCards, plan, changes, sessions] =
      await Promise.all([
        db.records("subjects").toArray(),
        db
          .records("tasks")
          .where("scheduledDate")
          .equals(date)
          .filter((t) => t.state !== "cancelled")
          .toArray(),
        db.records("exams").where("date").aboveOrEqual(date).first(),
        db
          .records("flashcards")
          .where("due")
          .belowOrEqual(new Date().toISOString())
          .filter((c) => !c.isSuspended)
          .count(),
        db.records("plans").orderBy("generatedAt").last(),
        db
          .records("planChanges")
          .orderBy("createdAt")
          .reverse()
          .limit(1)
          .toArray(),
        db.records("sessions").where("state").anyOf("active", "paused").first(),
      ]);
    const readiness = exam
      ? await db
          .records("readinessSnapshots")
          .where("examId")
          .equals(exam.id)
          .sortBy("calculatedAt")
      : [];
    return {
      subjects,
      tasks,
      exam,
      dueCards,
      plan,
      changes,
      session: sessions,
      readiness: readiness.at(-1),
    };
  }, [date]);
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  const remaining = data.tasks.filter(
      (t) => t.state === "planned" || t.state === "in progress",
    ),
    total = remaining.reduce((n, t) => n + t.estimatedMinutes, 0),
    done = data.tasks.filter((t) => t.state === "completed").length;
  const subjects = new Map(data.subjects.map((s) => [s.id, s]));
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {displayDate(date, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1>A little progress, every day.</h1>
          <p className="muted">
            Your next step is right here. Let’s make it a good one.
          </p>
        </div>
        <Action onAction={() => replan("You requested a fresh plan")}>
          ↻ Refresh plan
        </Action>
      </div>
      {!data.subjects.length ? (
        <section className="welcome">
          <p className="eyebrow">WELCOME TO YOUR STUDY SPACE</p>
          <h2>
            Big goals.
            <br />
            Manageable steps.
          </h2>
          <p>
            Tell StudyOS what you’re learning and when you have time.
            <br />
            Build a realistic plan, then focus on the next step.
          </p>
          <Link className="button primary" to="/subjects">
            Create your first subject →
          </Link>
          <Link className="text-link" to="/settings">
            Or import a Study Pack
          </Link>
          <div className="welcome-art" aria-hidden="true">
            <span>✦</span>
            <div className="book book-one" />
            <div className="book book-two" />
            <div className="book book-three" />
          </div>
        </section>
      ) : null}
      <div className="stats-grid">
        <div className="stat">
          <span>Planned focus</span>
          <strong>
            {total}
            <small> min</small>
          </strong>
          <p>{remaining.length} sessions ahead</p>
        </div>
        <div className="stat">
          <span>Cards ready to review</span>
          <strong>{data.dueCards}</strong>
          <Link to="/flashcards?mode=review">Keep your knowledge fresh →</Link>
        </div>
        <div className="stat">
          <span>Today’s progress</span>
          <strong>
            {done}
            <small> / {data.tasks.length}</small>
          </strong>
          <p>Study blocks completed</p>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Your focus today</h2>
            <span className="badge">{total} min</span>
          </div>
          {data.session ? (
            <div className="notice">
              You have a {data.session.state} session.{" "}
              <Link to="/study">Continue session →</Link>
            </div>
          ) : null}
          {remaining.length ? (
            <>
              <Action
                className="primary"
                onAction={async () => {
                  await startSession(remaining[0].id);
                  navigate("/study");
                }}
              >
                ▷ Start study session
              </Action>
              <ol className="task-list">
                {data.tasks.map((task) => (
                  <li key={task.id}>
                    <span
                      className={`task-check ${task.state === "completed" ? "done" : ""}`}
                      aria-hidden="true"
                    >
                      {task.state === "completed" ? "✓" : "○"}
                    </span>
                    <div>
                      <span
                        className="eyebrow"
                        style={{ color: subjects.get(task.subjectId)?.color }}
                      >
                        {subjects.get(task.subjectId)?.name}
                      </span>
                      <h3>{task.title}</h3>
                      <p className="muted small">
                        {task.type} · {task.estimatedMinutes} min · {task.state}
                      </p>
                      <details>
                        <summary>Why this task?</summary>
                        <p>{task.explanation}</p>
                      </details>
                    </div>
                    {task.state === "planned" ? (
                      <Action
                        onAction={async () => {
                          await startSession(task.id);
                          navigate("/study");
                        }}
                      >
                        Start
                      </Action>
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <Empty
              title={
                done
                  ? "You’ve made room for progress."
                  : "Your day has room to grow."
              }
            >
              <p>
                {done
                  ? "Your planned work is complete. Rest, or explore an extra topic."
                  : "Add an exam with topics and set your availability to build a plan."}
              </p>
              <Link to="/calendar">Set up your study week →</Link>
            </Empty>
          )}
        </section>
        <aside className="stack">
          <section className="panel">
            <p className="eyebrow">ON THE HORIZON</p>
            {data.exam ? (
              <>
                <h2>{data.exam.title}</h2>
                <p className="muted">
                  {displayDate(data.exam.date)} ·{" "}
                  {daysBetween(data.exam.date, date)} days away
                </p>
                <div className="readiness-number">
                  {data.readiness
                    ? `${Math.round(data.readiness.score * 100)}%`
                    : "—"}
                </div>
                <p>StudyOS readiness</p>
                <p className="small muted">
                  {data.readiness?.reasons[0] ??
                    "Review cards or answer questions to build evidence."}
                </p>
                <Link to={`/subjects/${data.exam.subjectId}?tab=exams`}>
                  View exam →
                </Link>
              </>
            ) : (
              <>
                <h2>What are you working toward?</h2>
                <p className="muted">
                  Add an exam to turn your topics into a focused plan.
                </p>
                <Link to="/subjects">Choose a subject →</Link>
              </>
            )}
          </section>
          <section
            className={`panel ${data.plan?.status === "infeasible" ? "warning-panel" : ""}`}
          >
            <h2>A plan that fits your life</h2>
            <p className="small pre-wrap">
              {data.changes[0]?.summary ??
                "StudyOS works with your availability. Missed work gets a fresh plan."}
            </p>
            <Link to="/calendar?tab=availability">Adjust availability →</Link>
          </section>
        </aside>
      </div>
    </>
  );
}
