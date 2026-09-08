import { useEffect, useRef, useState } from "react";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { Action, ErrorMessage } from "../../components/Feedback";
import StudyPackImport from "./StudyPackImport";
import { readFile } from "./file-client";
import {
  createBackup,
  download,
  exportBackup,
  exportPack,
  restoreBackup,
} from "./service";
import type { Backup } from "./validation";
import type { StudyPack } from "./pack-schema";

export default function PortabilityPanel() {
  const { data } = useQuery(async () => ({
    subjects: await db.records("subjects").toArray(),
  }));
  const [backup, setBackup] = useState<Backup>(),
    [safety, setSafety] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
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

  async function selectBackup(file: File) {
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setBusy(true);
    setError("");
    setMessage("");
    setBackup(undefined);
    setSafety(false);
    setConfirmation("");
    try {
      setBackup((await readFile(file, "backup", job.signal)).backup);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StudyPackImport />
      <section className="panel">
        <h2>Export Learning Content</h2>
        <label>
          Subject
          <select
            name="exportSubject"
            value={exportSubject}
            onChange={(event) => {
              setExportSubject(event.target.value);
              setExportTopic("");
              setExportPreview(undefined);
            }}
          >
            <option value="">Choose a subject</option>
            {data?.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Topics
          <select
            name="exportTopic"
            value={exportTopic}
            onChange={(event) => {
              setExportTopic(event.target.value);
              setExportPreview(undefined);
            }}
          >
            <option value="">Entire subject</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title} and descendants
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
          Preview Content Export
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
      </section>
      <section className="panel">
        <h2>Backup & Restore</h2>
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
          Download Full Backup
        </Action>
        <div className="divider" />
        <label className="file-picker">
          Preview a backup to restore (up to 100&nbsp;MB)
          <input
            type="file"
            accept=".studyos,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void selectBackup(file);
              event.target.value = "";
            }}
          />
        </label>
        {backup ? (
          <div className="import-preview">
            <h3>Replace This Workspace</h3>
            <p>
              Backup from {new Date(backup.exportedAt).toLocaleString()} · data
              version {backup.dataVersion}
            </p>
            <p>
              {Object.values(backup.counts).reduce(
                (total, value) => total + value,
                0,
              )}{" "}
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
                Download Current Workspace Safety Backup
              </Action>
            ) : (
              <p>Safety backup download created.</p>
            )}
            <label>
              Type RESTORE to confirm
              <input
                name="restoreConfirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
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
              Replace Workspace With Backup
            </Action>
          </div>
        ) : null}
        <p className="small muted">
          Browser storage can be cleared or evicted. Persistent storage helps,
          but it is not a backup and does not sync devices.
        </p>
      </section>
      {busy ? <p role="status">Validating backup…</p> : null}
      <ErrorMessage message={error} />
      <p role="status">{message}</p>
    </>
  );
}
