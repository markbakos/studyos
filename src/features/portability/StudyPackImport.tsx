import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { Action, ErrorMessage } from "../../components/Feedback";
import { replan } from "../planning/service";
import { readFile } from "./file-client";
import { importPack } from "./service";
import type { StudyPack } from "./pack-schema";

export default function StudyPackImport({
  title = "Study Packs",
  description = "Bring structured learning content from your own files or an external generator. Preview everything before it reaches your workspace.",
  initialTarget = "",
}: {
  title?: string;
  description?: string;
  initialTarget?: string;
}) {
  const { data } = useQuery(async () => ({
    subjects: await db.records("subjects").toArray(),
    imports: await db
      .records("imports")
      .orderBy("createdAt")
      .reverse()
      .limit(20)
      .toArray(),
  }));
  const [pack, setPack] = useState<StudyPack>(),
    [target, setTarget] = useState(initialTarget),
    [copy, setCopy] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [fileName, setFileName] = useState(""),
    [json, setJson] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function select(file: File) {
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setBusy(true);
    setError("");
    setMessage("");
    setPack(undefined);
    setFileName(file.name);
    try {
      setPack(await readFile(file, "pack", job.signal));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not read Study Pack.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <label>
        Paste generated Study Pack JSON
        <textarea
          name="generatedPack"
          value={json}
          onChange={(event) => setJson(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          rows={8}
          placeholder='Paste the raw JSON object beginning with { "formatVersion": 1, …'
        />
      </label>
      <button
        disabled={busy || !json.trim()}
        onClick={() =>
          void select(
            new File([json], "generated.study.json", {
              type: "application/json",
            }),
          )
        }
      >
        Validate Pasted JSON
      </button>
      <div className="divider" />
      <label className="file-picker">
        Or select a Study Pack (JSON, up to 10&nbsp;MB)
        <input
          type="file"
          accept=".json,.study.json"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void select(file);
            event.target.value = "";
          }}
        />
      </label>
      {busy ? (
        <p role="status">
          Validating file…{" "}
          <button onClick={() => controller.current?.abort()}>Cancel</button>
        </p>
      ) : null}
      {pack ? (
        <div className="import-preview">
          <h3>{pack.title}</h3>
          <p>
            {pack.topics.length} topics · {pack.notes.length} notes ·{" "}
            {pack.flashcards.length} cards · {pack.practiceQuestions.length}{" "}
            questions
          </p>
          <p className="muted">{pack.metadata.sourceDescription}</p>
          <p>Rights: {pack.metadata.license}</p>
          <label>
            Import into
            <select
              name="targetSubject"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">Create a new subject</option>
              {data?.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="choice">
            <input
              name="separateCopy"
              type="checkbox"
              checked={copy}
              onChange={(event) => setCopy(event.target.checked)}
            />
            Import a separate copy, including duplicates
          </label>
          <p className="small muted">
            Exact packs are blocked by default. Matching topic paths, card
            fronts, and question prompts are skipped unless you choose a
            separate copy.
          </p>
          <Action
            className="primary"
            onAction={async () => {
              const result = await importPack(
                pack,
                fileName,
                target || undefined,
                copy,
              );
              setMessage(
                `Imported ${result.count} records. Your content is ready to study.`,
              );
              setPack(undefined);
              setJson("");
              await replan("Study Pack imported");
            }}
          >
            Import Study Pack
          </Action>
        </div>
      ) : null}
      <ErrorMessage message={error} />
      <p role="status">{message}</p>
      {message.includes("Imported") ? (
        <Link to="/subjects">Open your subjects →</Link>
      ) : null}
      <details>
        <summary>Recent imports ({data?.imports.length ?? 0})</summary>
        {data?.imports.map((record) => (
          <p key={record.id}>
            {record.fileName} · {record.createdIds.length} records ·{" "}
            {new Date(record.createdAt).toLocaleString()}
          </p>
        ))}
      </details>
    </section>
  );
}
