import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { Action, ErrorMessage, Loading } from "../../components/Feedback";
import { packJsonSchema } from "../portability/validation";
import StudyPackImport from "../portability/StudyPackImport";
import { createStudyPackPrompt, promptKinds, type PromptKind } from "./prompt";

export default function CreatePage() {
  const [params] = useSearchParams(),
    requestedSubject = params.get("subject") ?? "",
    requestedKind = params.get("kind"),
    initialKind = promptKinds.some((kind) => kind.value === requestedKind)
      ? (requestedKind as PromptKind)
      : "complete";
  const [kind, setKind] = useState<PromptKind>(initialKind),
    [subjectId, setSubjectId] = useState(requestedSubject),
    [subjectName, setSubjectName] = useState(""),
    [level, setLevel] = useState(""),
    [goal, setGoal] = useState(""),
    [topics, setTopics] = useState(params.get("focus") ?? ""),
    [amount, setAmount] = useState(""),
    [sources, setSources] = useState(""),
    [prompt, setPrompt] = useState(""),
    [message, setMessage] = useState("");
  const { data: subjects, error } = useQuery(() =>
      db
        .records("subjects")
        .filter((subject) => !subject.isArchived)
        .toArray(),
    ),
    { data: topicRows = [] } = useQuery(
      () =>
        db
          .records("topics")
          .where("subjectId")
          .equals(subjectId)
          .sortBy("position"),
      [subjectId],
    );
  if (error) return <ErrorMessage message={error} />;
  if (!subjects) return <Loading />;
  const selected = subjects.find((subject) => subject.id === subjectId),
    existingTopics = topicRows.map((topic) => topic.title);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CREATE WITH ANY AI</p>
          <h1>Generate Your Study Material</h1>
          <p className="muted">
            Shape the request here, attach source files in your AI chat, then
            paste the generated Study Pack back into StudyOS.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>1. Build a Prompt</h2>
        <p className="muted">
          Choose a focused agent prompt or generate the full learning pack.
          Manual creation remains available on each content page.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const subject = selected?.name || subjectName;
            setPrompt(
              createStudyPackPrompt({
                kind,
                subject,
                level,
                goal,
                topics,
                sourceInstructions: sources,
                amount,
                existingTopics,
                language: navigator.language,
                schema: packJsonSchema,
              }),
            );
            setMessage("Prompt ready. Copy it into your preferred AI chat.");
          }}
        >
          <div className="form-grid">
            <label>
              What should the AI create?
              <select
                name="kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as PromptKind)}
              >
                {promptKinds.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              StudyOS subject
              <select
                name="subjectId"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
              >
                <option value="">Create a new subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            {!selected ? (
              <label>
                New subject name
                <input
                  name="subjectName"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  required
                  autoComplete="off"
                  placeholder="Example: Organic Chemistry…"
                />
              </label>
            ) : null}
            <label>
              Your level
              <input
                name="level"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                autoComplete="off"
                placeholder="Example: First-year university…"
              />
            </label>
            <label className="wide">
              What do you need to learn or achieve?
              <textarea
                name="goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                required
                autoComplete="off"
                rows={3}
                placeholder="Example: Prepare for an exam on mechanisms and synthesis…"
              />
            </label>
            <label className="wide">
              Topics or scope
              <textarea
                name="topics"
                value={topics}
                onChange={(event) => setTopics(event.target.value)}
                autoComplete="off"
                rows={3}
                placeholder="List required topics, syllabus units, or areas to exclude…"
              />
            </label>
            <label>
              Amount and depth
              <input
                name="amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                autoComplete="off"
                placeholder="Example: 40 cards, exam depth…"
              />
            </label>
            <label>
              Source instructions
              <input
                name="sources"
                value={sources}
                onChange={(event) => setSources(event.target.value)}
                autoComplete="off"
                placeholder="Example: Use my attached lecture PDFs first…"
              />
            </label>
          </div>
          <button className="primary">Create Prompt</button>
        </form>
        {prompt ? (
          <div className="prompt-output">
            <label>
              Prompt for ChatGPT, Codex, Claude, or another model
              <textarea readOnly value={prompt} rows={14} />
            </label>
            <Action
              className="primary"
              onAction={async () => {
                await navigator.clipboard.writeText(prompt);
                setMessage(
                  "Prompt copied. Paste it into your AI chat and attach any source files there.",
                );
              }}
            >
              Copy Prompt
            </Action>
          </div>
        ) : null}
        <p role="status" className="muted">
          {message}
        </p>
      </section>
      <StudyPackImport
        key={subjectId}
        title="2. Import the AI Result"
        initialTarget={subjectId}
        description="Paste the raw JSON returned by the AI, or select a downloaded Study Pack. StudyOS validates and previews it before import."
      />
    </>
  );
}
