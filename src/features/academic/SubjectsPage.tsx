import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { identity, type Subject } from "../../types/model";
import { saveRecord } from "./service";
import { RecordForm } from "../../components/RecordForm";
import { Empty, ErrorMessage, Loading } from "../../components/Feedback";
import * as Collection from "../../components/Collection";
export const subjectFields = [
  { name: "name", label: "Subject name", required: true },
  { name: "shortName", label: "Short name" },
  { name: "term", label: "Term" },
  {
    name: "color",
    label: "Subject color",
    type: "color" as const,
    defaultValue: "#5268d9",
  },
  {
    name: "priority",
    label: "Priority (1–5)",
    type: "number" as const,
    min: 1,
    max: 5,
    defaultValue: 3,
  },
  { name: "description", label: "Description", type: "textarea" as const },
];
export default function SubjectsPage() {
  const { data, error } = useQuery(() =>
      db.records("subjects").orderBy("name").toArray(),
    ),
    [adding, setAdding] = useState(false),
    navigate = useNavigate();
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BUILD YOUR LEARNING MAP</p>
          <h1>Subjects</h1>
          <p className="muted">
            A clear home for everything you want to understand.
          </p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>
          + Add subject
        </button>
      </div>
      {adding ? (
        <section className="panel">
          <h2>New subject</h2>
          <RecordForm
            fields={subjectFields}
            submitLabel="Create subject"
            onCancel={() => setAdding(false)}
            onSave={async (values) => {
              const subject = await saveRecord("subjects", {
                ...identity(),
                ...values,
              });
              navigate(`/subjects/${subject.id}`);
            }}
          />
        </section>
      ) : null}
      {!data.length ? (
        <Empty title="Start with one subject">
          <p>
            Add what you’re learning, break it into topics, and give your next
            exam a date. Your plan starts there.
          </p>
          <button onClick={() => setAdding(true)}>
            Create your first subject
          </button>
          <p>
            Already have content?{" "}
            <Link to="/settings">Import a Study Pack</Link>
          </p>
        </Empty>
      ) : (
        <Collection.Root>
          <Collection.Search />
          <Collection.Items<Subject>
            items={data}
            text={(s) => `${s.name} ${s.term}`}
          >
            {(subject) => (
              <Link className="subject-card" to={`/subjects/${subject.id}`}>
                <span
                  className="subject-icon"
                  style={{ background: subject.color }}
                  aria-hidden="true"
                >
                  {subject.shortName.slice(0, 2) || subject.name.slice(0, 2)}
                </span>
                <div>
                  <h2>{subject.name}</h2>
                  <p className="muted">
                    {subject.term || "Personal learning"}
                    {subject.isArchived ? " · Archived" : ""}
                  </p>
                </div>
                <span aria-hidden="true">↗</span>
              </Link>
            )}
          </Collection.Items>
        </Collection.Root>
      )}
    </>
  );
}
