import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { Action, ErrorMessage } from "../../components/Feedback";
import { readFile } from "./file-client";
import {
  createBackup,
  download,
  exportBackup,
  exportPack,
  importPack,
  restoreBackup,
} from "./service";
import type { Backup } from "./validation";
import type { StudyPack } from "./pack-schema";
import { replan } from "../planning/service";
export default function PortabilityPanel() {
  const { data } = useQuery(async () => ({
    subjects: await db.records("subjects").toArray(),
    imports: await db
      .records("imports")
      .orderBy("createdAt")
      .reverse()
      .limit(20)
      .toArray(),
    count:
      (await db.records("subjects").count()) +
      (await db.records("sessions").count()) +
      (await db.records("availabilityRules").count()),
  }));
  const [pack, setPack] = useState<StudyPack>(),
    [backup, setBackup] = useState<Backup>(),
    [target, setTarget] = useState(""),
    [copy, setCopy] = useState(false),
    [safety, setSafety] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [fileName, setFileName] = useState(""),
    [exportSubject, setExportSubject] = useState(""),
    [exportTopic, setExportTopic] = useState(""),
    [exportPreview, setExportPreview] = useState<StudyPack>();
  const controller = useRef<AbortController | null>(null);
  const { data: topics = [] } = useQuery(
    () =>
      db.records("topics").where("subjectId").equals(exportSubject).toArray(),
    [exportSubject],
  );
  useEffect(() => () => controller.current?.abort(), []);
  async function select(file: File, kind: "pack" | "backup") {
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setBusy(true);
    setError("");
    setMessage("");
    setPack(undefined);
    setBackup(undefined);
    setSafety(false);
    setConfirmation("");
    setFileName(file.name);
    try {
      if (kind === "pack") setPack(await readFile(file, "pack", job.signal));
      else setBackup((await readFile(file, "backup", job.signal)).backup);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <h2>Study Packs</h2>
        <p className="muted">
          Bring structured learning content from your own files or an external
          generator. Preview everything before it reaches your workspace.
        </p>
        <label className="file-picker">
          Select a Study Pack (JSON, up to 10 MB)
          <input
            type="file"
            accept=".json,.study.json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void select(file, "pack");
              e.target.value = "";
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
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Create a new subject</option>
                {data?.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={copy}
                onChange={(e) => setCopy(e.target.checked)}
              />
              Import a separate copy, including duplicates
            </label>
            <p className="small muted">
              Exact previously imported packs are blocked by default. Matching
              topic paths, card fronts, and question prompts in your selected
              subject are skipped unless you choose a separate copy.
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
                await replan("Study Pack imported");
              }}
            >
              Import Study Pack
            </Action>
          </div>
        ) : null}
        <div className="divider" />
        <h3>Export learning content</h3>
        <label>
          Subject
          <select
            value={exportSubject}
            onChange={(e) => {
              setExportSubject(e.target.value);
              setExportTopic("");
              setExportPreview(undefined);
            }}
          >
            <option value="">Choose a subject</option>
            {data?.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Topics
          <select
            value={exportTopic}
            onChange={(e) => {
              setExportTopic(e.target.value);
              setExportPreview(undefined);
            }}
          >
            <option value="">Entire subject</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} and descendants
              </option>
            ))}
          </select>
        </label>
        <Action
          disabled={!exportSubject}
          onAction={async () =>
            setExportPreview(
              await exportPack(exportSubject, exportTopic || undefined),
            )
          }
        >
          Preview content export
        </Action>
        {exportPreview ? (
          <div className="notice">
            <p>
              {exportPreview.topics.length} topics ·{" "}
              {exportPreview.notes.length} notes ·{" "}
              {exportPreview.flashcards.length} cards ·{" "}
              {exportPreview.practiceQuestions.length} questions. Study history
              is excluded.
            </p>
            <button
              onClick={() =>
                download(
                  JSON.stringify(exportPreview, null, 2),
                  "study-content.study.json",
                )
              }
            >
              Download Study Pack
            </button>
          </div>
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
      <section className="panel">
        <h2>Backup & restore</h2>
        <p className="muted">
          A full backup includes your content, study history, settings, and
          stored files. It contains private data and is not encrypted.
        </p>
        <Action
          className="primary"
          onAction={async () => {
            await exportBackup();
            setMessage("Backup download created. Keep it somewhere safe.");
          }}
        >
          Download full backup
        </Action>
        <div className="divider" />
        <label className="file-picker">
          Preview a backup to restore (up to 100 MB)
          <input
            type="file"
            accept=".studyos,.json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void select(file, "backup");
              e.target.value = "";
            }}
          />
        </label>
        {backup ? (
          <div className="import-preview">
            <h3>Replace this workspace</h3>
            <p>
              Backup from {new Date(backup.exportedAt).toLocaleString()} · data
              version {backup.dataVersion}
            </p>
            <p>
              {Object.values(backup.counts).reduce((n, value) => n + value, 0)}{" "}
              records across {Object.keys(backup.counts).length} tables.
              Checksum and relationships validated.
            </p>
            <p className="warning">
              Restoring replaces all current data. This cannot be undone without
              your safety backup.
            </p>
            {!safety ? (
              <Action
                onAction={async () => {
                  const fresh = await createBackup();
                  download(
                    JSON.stringify(fresh),
                    `studyos-safety-${Date.now()}.studyos`,
                  );
                  setSafety(true);
                }}
              >
                Download current workspace safety backup
              </Action>
            ) : (
              <p>Safety backup download created.</p>
            )}
            <label>
              Type RESTORE to confirm
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </label>
            <Action
              className="danger"
              disabled={!safety || confirmation !== "RESTORE"}
              onAction={async () => {
                await restoreBackup(backup);
                setBackup(undefined);
                setSafety(false);
                setMessage("Backup restored. Your workspace is ready.");
              }}
            >
              Replace workspace with backup
            </Action>
          </div>
        ) : null}
        <p className="small muted">
          Browser storage can be cleared or evicted. Persistent storage helps,
          but it is not a backup and does not sync devices.
        </p>
      </section>
      <ErrorMessage message={error} />
      <p role="status">{message}</p>
      {message.includes("Imported") ? (
        <Link to="/subjects">Open your subjects →</Link>
      ) : null}
    </>
  );
}
