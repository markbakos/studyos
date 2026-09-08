import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { today, nextDate, displayDate } from "../../engine/dates";
import { identity } from "../../types/model";
import { saveRecord, removeInput } from "./service";
import { replan } from "../planning/service";
import { RecordForm, type Field } from "../../components/RecordForm";
import { Action, ErrorMessage, Loading } from "../../components/Feedback";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export default function CalendarPage() {
  const [params, setParams] = useSearchParams(),
    date = params.get("date") || today(),
    view = params.get("view") || "week",
    availability = params.get("tab") === "availability";
  const [form, setForm] = useState<"rule" | "exception" | "event" | null>(null);
  const range = view === "month" ? 31 : view === "term" ? 120 : 7,
    end = nextDate(date, range);
  const { data, error } = useQuery(
    async () => ({
      tasks: await db
        .records("tasks")
        .where("scheduledDate")
        .between(date, end, true, false)
        .filter((t) => t.state !== "cancelled")
        .toArray(),
      exams: await db
        .records("exams")
        .where("date")
        .between(date, end, true, false)
        .toArray(),
      assignments: await db
        .records("assignments")
        .where("dueDate")
        .between(date, end, true, false)
        .toArray(),
      events: await db
        .records("calendarEvents")
        .where("startsAt")
        .between(
          new Date(`${date}T00:00`).toISOString(),
          new Date(`${end}T00:00`).toISOString(),
        )
        .toArray(),
      rules: await db.records("availabilityRules").toArray(),
      exceptions: await db
        .records("availabilityExceptions")
        .orderBy("date")
        .toArray(),
    }),
    [date, end],
  );
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  const fields: Field[] =
    form === "rule"
      ? [
          {
            name: "weekday",
            label: "Day",
            type: "select",
            options: weekdays.map((label, i) => ({ value: String(i), label })),
          },
          {
            name: "startTime",
            label: "From",
            type: "time",
            required: true,
            defaultValue: "17:00",
          },
          {
            name: "endTime",
            label: "Until",
            type: "time",
            required: true,
            defaultValue: "18:00",
          },
        ]
      : form === "exception"
        ? [
            { name: "date", label: "Date", type: "date", required: true },
            {
              name: "mode",
              label: "Change",
              type: "select",
              options: [
                { value: "unavailable", label: "Unavailable all day" },
                { value: "add", label: "Add a window" },
                { value: "remove", label: "Remove a window" },
                { value: "cap", label: "Cap daily minutes" },
              ],
            },
            {
              name: "startTime",
              label: "Start (window changes)",
              type: "time",
            },
            { name: "endTime", label: "End (window changes)", type: "time" },
            {
              name: "maxMinutes",
              label: "Daily cap (minutes)",
              type: "number",
              min: 0,
              defaultValue: 60,
            },
            { name: "reason", label: "Reason" },
          ]
        : [
            { name: "title", label: "Event title", required: true },
            {
              name: "startsAt",
              label: "Starts",
              type: "datetime-local",
              required: true,
            },
            {
              name: "endsAt",
              label: "Ends",
              type: "datetime-local",
              required: true,
            },
            { name: "location", label: "Location" },
          ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE ROOM FOR WHAT MATTERS</p>
          <h1>Calendar</h1>
          <p className="muted">
            Your deadlines, study blocks, and breathing room.
          </p>
        </div>
        <button onClick={() => setForm(availability ? "rule" : "event")}>
          + {availability ? "Availability window" : "Calendar event"}
        </button>
      </div>
      <nav className="tabs">
        <Link className={!availability ? "active" : ""} to="/calendar">
          Schedule
        </Link>
        <Link className={availability ? "active" : ""} to="?tab=availability">
          Availability
        </Link>
      </nav>
      {form ? (
        <section className="panel">
          <h2>
            {form === "rule"
              ? "Weekly study time"
              : form === "exception"
                ? "A change of plans"
                : "Calendar event"}
          </h2>
          <RecordForm
            fields={fields}
            onCancel={() => setForm(null)}
            onSave={async (values) => {
              const input = { ...values };
              if (form === "rule") input.weekday = Number(input.weekday);
              if (form === "exception") {
                input.startTime = input.startTime || undefined;
                input.endTime = input.endTime || undefined;
              }
              if (form === "event") {
                input.startsAt = new Date(String(input.startsAt)).toISOString();
                input.endsAt = new Date(String(input.endsAt)).toISOString();
              }
              await saveRecord(
                form === "rule"
                  ? "availabilityRules"
                  : form === "exception"
                    ? "availabilityExceptions"
                    : "calendarEvents",
                { ...identity(), ...input },
              );
              setForm(null);
              await replan("Availability or calendar changed");
            }}
          />
        </section>
      ) : null}
      {availability ? (
        <div className="two-columns">
          <section className="panel">
            <h2>Your usual week</h2>
            <p className="muted">
              Add as many windows as you need. Commitments are subtracted
              automatically.
            </p>
            {weekdays.map((day, i) => (
              <div className="availability-day" key={day}>
                <h3>{day}</h3>
                {data.rules
                  .filter((r) => r.weekday === i)
                  .map((rule) => (
                    <div className="inline-row" key={rule.id}>
                      <span>
                        {rule.startTime}–{rule.endTime}
                      </span>
                      <Action
                        onAction={async () => {
                          await removeInput("availabilityRules", rule.id);
                          await replan();
                        }}
                      >
                        Remove window
                      </Action>
                    </div>
                  ))}
                {!data.rules.some((r) => r.weekday === i) ? (
                  <span className="muted small">No study time set</span>
                ) : null}
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>One-off changes</h2>
            <button onClick={() => setForm("exception")}>
              Add date exception
            </button>
            {data.exceptions.map((e) => (
              <div className="availability-day" key={e.id}>
                <h3>{displayDate(e.date)}</h3>
                <p>
                  {e.mode} {e.startTime} {e.endTime}{" "}
                  {e.mode === "cap" ? `${e.maxMinutes} min` : ""}
                </p>
                <p className="muted">{e.reason}</p>
                <Action
                  onAction={async () => {
                    await removeInput("availabilityExceptions", e.id);
                    await replan();
                  }}
                >
                  Remove exception
                </Action>
              </div>
            ))}
          </section>
        </div>
      ) : (
        <>
          <div className="calendar-controls">
            <button
              onClick={() => setParams({ date: nextDate(date, -range), view })}
            >
              ← Previous
            </button>
            <label>
              Starting{" "}
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) setParams({ date: e.target.value, view });
                }}
              />
            </label>
            <label>
              View{" "}
              <select
                value={view}
                onChange={(e) => setParams({ date, view: e.target.value })}
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="term">Term</option>
              </select>
            </label>
            <button
              onClick={() => setParams({ date: nextDate(date, range), view })}
            >
              Next →
            </button>
          </div>
          <div className={`calendar-grid ${view === "term" ? "term" : ""}`}>
            {Array.from({ length: range }, (_, i) => {
              const day = nextDate(date, i);
              return (
                <section
                  className={`calendar-day ${day === today() ? "current-day" : ""}`}
                  key={day}
                >
                  <h2>
                    {displayDate(day, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </h2>
                  {data.exams
                    .filter((e) => e.date === day)
                    .map((e) => (
                      <Link
                        className="calendar-entry exam"
                        key={e.id}
                        to={`/subjects/${e.subjectId}?tab=exams`}
                      >
                        Exam · {e.title}
                      </Link>
                    ))}
                  {data.assignments
                    .filter((a) => a.dueDate === day)
                    .map((a) => (
                      <Link
                        className="calendar-entry assignment"
                        key={a.id}
                        to={`/subjects/${a.subjectId}?tab=assignments`}
                      >
                        Due · {a.title}
                      </Link>
                    ))}
                  {data.tasks
                    .filter((t) => t.scheduledDate === day)
                    .map((t) => (
                      <Link className="calendar-entry" key={t.id} to="/study">
                        {t.title}
                        <small>
                          {t.estimatedMinutes} min · {t.state}
                        </small>
                      </Link>
                    ))}
                  {data.events
                    .filter((e) => today(new Date(e.startsAt)) === day)
                    .map((e) => (
                      <div className="calendar-entry" key={e.id}>
                        {e.title}
                        <small>
                          {new Date(e.startsAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                        <Action
                          onAction={async () => {
                            if (confirm("Remove this calendar event?")) {
                              await removeInput("calendarEvents", e.id);
                              await replan();
                            }
                          }}
                        >
                          Remove
                        </Action>
                      </div>
                    ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
