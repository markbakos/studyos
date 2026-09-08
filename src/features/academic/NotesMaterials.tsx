import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { identity, type Records } from "../../types/model";
import { saveRecord } from "./service";
import { RecordForm } from "../../components/RecordForm";
import { Action, ErrorMessage } from "../../components/Feedback";
import { digest } from "../portability/validation";
export default function NotesMaterials({
  subjectId,
  topics,
}: {
  subjectId: string;
  topics: Records["topics"][];
}) {
  const { data } = useQuery(
    async () => ({
      notes: await db
        .records("notes")
        .where("subjectId")
        .equals(subjectId)
        .toArray(),
      materials: await db
        .records("materials")
        .where("subjectId")
        .equals(subjectId)
        .toArray(),
    }),
    [subjectId],
  );
  const [editing, setEditing] = useState<Records["notes"] | "new" | null>(null),
    [material, setMaterial] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="two-columns">
      <section className="panel">
        <div className="section-heading">
          <h2>Notes</h2>
          <button onClick={() => setEditing("new")}>+ Add note</button>
        </div>
        <p className="muted small">
          Markdown, tables, code, and math ($inline$ or $$block$$). HTML is
          never executed.
        </p>
        {editing ? (
          <RecordForm
            key={editing === "new" ? "new" : editing.id}
            fields={[
              { name: "title", label: "Note title", required: true },
              {
                name: "topic",
                label: "Topic",
                type: "select",
                options: [
                  { value: "", label: "Whole subject" },
                  ...topics.map((t) => ({ value: t.id, label: t.title })),
                ],
              },
              {
                name: "markdown",
                label: "Markdown",
                type: "textarea",
                required: true,
              },
            ]}
            initial={
              editing === "new"
                ? {}
                : { ...editing, topic: editing.topicIds[0] }
            }
            onCancel={() => setEditing(null)}
            onSave={async (values) => {
              const { topic, ...rest } = values;
              await saveRecord("notes", {
                ...(editing === "new" ? identity() : editing),
                ...rest,
                subjectId,
                topicIds: topic ? [topic] : [],
              });
              setEditing(null);
            }}
          />
        ) : null}
        {data?.notes.map((note) => (
          <article className="note" key={note.id}>
            <div className="section-heading">
              <h3>{note.title}</h3>
              <button onClick={() => setEditing(note)}>Edit note</button>
            </div>
            <div className="markdown">
              <Markdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[[rehypeKatex, { trust: false, strict: true }]]}
                skipHtml
              >
                {note.markdown}
              </Markdown>
            </div>
          </article>
        ))}
        {!data?.notes.length ? (
          <p className="muted">
            Capture an explanation in your own words, then test your recall.
          </p>
        ) : null}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Materials</h2>
          <button onClick={() => setMaterial(true)}>+ Add reference</button>
        </div>
        {material ? (
          <RecordForm
            fields={[
              { name: "title", label: "Material title", required: true },
              { name: "url", label: "Web URL (optional)" },
              {
                name: "citation",
                label: "Citation or file location",
                type: "textarea",
              },
            ]}
            onCancel={() => setMaterial(false)}
            onSave={async (values) => {
              await saveRecord("materials", {
                ...identity(),
                ...values,
                subjectId,
                kind: "web",
                storageMode: "reference",
              });
              setMaterial(false);
            }}
          />
        ) : null}
        <p className="muted small">
          Links need internet. Stored files are available offline and included
          in your unencrypted backup. Maximum 10 MB per file.
        </p>
        <label className="file-picker">
          Store a file on this device
          <input
            type="file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 10 * 1024 * 1024)
                  throw new Error(
                    "Choose a file under 10 MB, or add it as a reference.",
                  );
                const estimate = await navigator.storage?.estimate();
                if (
                  estimate?.quota &&
                  file.size * 2 > estimate.quota - (estimate.usage ?? 0)
                )
                  throw new Error(
                    "Not enough local storage. Export a backup before freeing space.",
                  );
                if (
                  !confirm(
                    `Store ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB) locally and include it in backups?`,
                  )
                )
                  return;
                const bytes = new Uint8Array(await file.arrayBuffer()),
                  checksum = await digest(bytes);
                let binary = "";
                for (let i = 0; i < bytes.length; i += 8192)
                  binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
                const materialId = identity(),
                  blobId = identity();
                await db.transaction(
                  "rw",
                  [db.table("materials"), db.table("materialBlobs")],
                  async () => {
                    await db
                      .records("materials")
                      .add({
                        ...materialId,
                        subjectId,
                        topicIds: [],
                        title: file.name,
                        kind: "custom",
                        storageMode: "stored",
                        url: "",
                        citation: "",
                        blobId: blobId.id,
                        sizeBytes: file.size,
                      });
                    await db
                      .records("materialBlobs")
                      .add({
                        ...blobId,
                        materialId: materialId.id,
                        mimeType: file.type || "application/octet-stream",
                        sizeBytes: file.size,
                        checksum,
                        base64: btoa(binary),
                      });
                  },
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not store this file.",
                );
              } finally {
                e.target.value = "";
              }
            }}
          />
        </label>
        <ErrorMessage message={error} />
        {data?.materials.map((item) => (
          <article className="note" key={item.id}>
            <h3>{item.title}</h3>
            <p className="muted small">
              {item.storageMode === "stored"
                ? `${(item.sizeBytes / 1024).toFixed(0)} KB · available offline`
                : "External reference"}
            </p>
            {item.citation ? <p>{item.citation}</p> : null}
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer">
                Open external material ↗
              </a>
            ) : null}
            {item.blobId ? (
              <Action
                onAction={async () => {
                  const blob = await db
                    .records("materialBlobs")
                    .get(item.blobId!);
                  if (!blob)
                    throw new Error(
                      "Stored file is missing. Restore a backup.",
                    );
                  const bytes = Uint8Array.from(atob(blob.base64), (c) =>
                      c.charCodeAt(0),
                    ),
                    url = URL.createObjectURL(
                      new Blob([bytes], { type: "application/octet-stream" }),
                    ),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = item.title;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download stored file
              </Action>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
