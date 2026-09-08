import { Link } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { today, nextDate, displayDate } from "../../engine/dates";
import { ErrorMessage, Loading } from "../../components/Feedback";
export default function ProgressPage() {
  const { data, error } = useQuery(async () => ({
    sessions: await db
      .records("sessions")
      .orderBy("startedAt")
      .reverse()
      .limit(200)
      .toArray(),
    reviews: await db.records("reviews").count(),
    attempts: await db.records("attempts").count(),
    topics: await db.records("topics").toArray(),
    mastery: await db
      .records("masterySnapshots")
      .orderBy("calculatedAt")
      .reverse()
      .limit(1000)
      .toArray(),
    exams: await db.records("exams").toArray(),
    readiness: await db
      .records("readinessSnapshots")
      .orderBy("calculatedAt")
      .reverse()
      .limit(500)
      .toArray(),
    changes: await db
      .records("planChanges")
      .orderBy("createdAt")
      .reverse()
      .limit(10)
      .toArray(),
  }));
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  const completed = data.sessions.filter((s) => s.state === "completed"),
    minutes = completed.reduce((n, s) => n + s.actualMinutes, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEE HOW FAR YOU’VE COME</p>
          <h1>Progress</h1>
          <p className="muted">Evidence of understanding, with room to grow.</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <span>Focused time</span>
          <strong>
            {Math.round(minutes)}
            <small> min</small>
          </strong>
          <p>Across your latest 200 sessions</p>
        </div>
        <div className="stat">
          <span>Retrieval practice</span>
          <strong>{data.reviews}</strong>
          <p>Flashcard reviews</p>
        </div>
        <div className="stat">
          <span>Applied knowledge</span>
          <strong>{data.attempts}</strong>
          <p>Practice attempts</p>
        </div>
      </div>
      <section className="panel">
        <h2>The last two weeks</h2>
        <div className="activity-chart">
          {Array.from({ length: 14 }, (_, i) => {
            const date = nextDate(today(), i - 13),
              value = completed
                .filter((s) => today(new Date(s.startedAt)) === date)
                .reduce((n, s) => n + s.actualMinutes, 0);
            return (
              <div key={date}>
                <div className="bar-track">
                  <div
                    style={{ height: `${Math.min(100, (value / 180) * 100)}%` }}
                  />
                </div>
                <span>{displayDate(date, { day: "numeric" })}</span>
                <small>{Math.round(value)}m</small>
              </div>
            );
          })}
        </div>
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Topic understanding</h2>
          {data.topics.slice(0, 100).map((topic) => {
            const signal = data.mastery.find((s) => s.topicId === topic.id);
            return (
              <div className="signal-row" key={topic.id}>
                <Link to={`/subjects/${topic.subjectId}`}>{topic.title}</Link>
                <span>{signal?.band ?? "No evidence yet"}</span>
                <progress
                  max={1}
                  value={signal?.score ?? 0}
                  aria-label={`${topic.title} mastery`}
                />
                <details>
                  <summary>What contributes?</summary>
                  <p>
                    {signal?.reasons.join(". ") ??
                      "Answer questions and review cards to build this signal. Time spent alone does not prove mastery."}
                  </p>
                </details>
              </div>
            );
          })}
          {!data.topics.length ? (
            <p className="muted">
              Add topics and study them to see your understanding develop.
            </p>
          ) : null}
        </section>
        <section className="panel">
          <h2>Exam readiness</h2>
          {data.exams.map((exam) => {
            const signal = data.readiness.find((s) => s.examId === exam.id);
            return (
              <div className="signal-row" key={exam.id}>
                <h3>{exam.title}</h3>
                <strong>
                  {signal
                    ? `${Math.round(signal.score * 100)}%`
                    : "No evidence yet"}
                </strong>
                <p className="muted small">
                  {signal?.reasons.join(". ") ??
                    "Readiness appears after your first review or practice attempt."}
                </p>
              </div>
            );
          })}
          <p className="small muted">
            These signals guide study choices. They do not predict an exam
            grade.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Recent study history</h2>
        {completed.slice(0, 20).map((s) => (
          <details key={s.id}>
            <summary>
              {displayDate(s.startedAt)} · {Math.round(s.actualMinutes)} minutes
              · focus {s.focusRating ?? "—"}/5
            </summary>
            <p className="pre-wrap">{s.notes || "No session notes."}</p>
          </details>
        ))}
        {!completed.length ? (
          <p className="muted">Your completed sessions will appear here.</p>
        ) : null}
        <h2>How your plan changed</h2>
        {data.changes.map((c) => (
          <details key={c.id}>
            <summary>
              {displayDate(c.createdAt)} · {c.reason}
            </summary>
            <p>{c.summary}</p>
          </details>
        ))}
      </section>
    </>
  );
}
