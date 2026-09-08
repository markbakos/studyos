import { lazy, Suspense, useState } from "react";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { saveRecord } from "../academic/service";
import { replan } from "../planning/service";
import { RecordForm } from "../../components/RecordForm";
import { Action, ErrorMessage, Loading } from "../../components/Feedback";
const Portability = lazy(() => import("../portability/PortabilityPanel"));
export default function SettingsPage() {
  const { data, error } = useQuery(() =>
      db.records("settings").get("settings"),
    ),
    [storage, setStorage] = useState(
      "Check how this browser stores your data.",
    );
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE THIS SPACE YOURS</p>
          <h1>Settings</h1>
          <p className="muted">Your pace, your preferences, your data.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Your study rhythm</h2>
        <RecordForm
          key={data.id}
          initial={data}
          submitLabel="Save preferences"
          fields={[
            {
              name: "theme",
              label: "Appearance",
              type: "select",
              options: [
                { value: "system", label: "Use device setting" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ],
            },
            {
              name: "locale",
              label: "Locale",
              defaultValue: navigator.language,
            },
            {
              name: "weekStart",
              label: "Week begins",
              type: "select",
              options: [
                { value: "1", label: "Monday" },
                { value: "0", label: "Sunday" },
              ],
            },
            {
              name: "sessionMinutes",
              label: "Preferred session length (minutes)",
              type: "number",
              min: 5,
              max: 120,
            },
            {
              name: "dailyLimit",
              label: "Maximum daily study load (minutes)",
              type: "number",
              min: 15,
              max: 720,
            },
            {
              name: "backupReminderDays",
              label: "Backup reminder every N days (0 = off)",
              type: "number",
              min: 0,
              max: 365,
            },
          ]}
          onSave={async (values) => {
            try {
              new Intl.DateTimeFormat(String(values.locale));
            } catch {
              throw new Error("Enter a valid locale, such as en-GB.");
            }
            await saveRecord("settings", {
              ...data,
              ...values,
              weekStart: Number(values.weekStart),
              onboardingDone: true,
            });
            await replan("Study preferences updated");
          }}
        />
      </section>
      <section className="panel">
        <h2>On this device</h2>
        <p>{storage}</p>
        <div className="button-row">
          <Action
            onAction={async () => {
              if (!navigator.storage)
                throw new Error(
                  "Storage status is not supported in this browser. Keep regular backups.",
                );
              const [persisted, estimate] = await Promise.all([
                navigator.storage.persisted(),
                navigator.storage.estimate(),
              ]);
              setStorage(
                `${persisted ? "Persistent" : "Best-effort"} storage · ${((estimate.usage ?? 0) / 1024 / 1024).toFixed(1)} MB used of approximately ${((estimate.quota ?? 0) / 1024 / 1024).toFixed(0)} MB available.`,
              );
            }}
          >
            Check storage
          </Action>
          <Action
            onAction={async () => {
              const granted = await navigator.storage?.persist();
              setStorage(
                granted
                  ? "Persistent storage granted. Keep backups too."
                  : "Persistence was not granted by this browser. You can still study; keep regular backups.",
              );
            }}
          >
            Request persistent storage
          </Action>
        </div>
        <p className="small muted">
          Last backup:{" "}
          {data.lastBackup
            ? new Date(data.lastBackup).toLocaleString()
            : "No backup exported yet"}
        </p>
        <p className="small muted">
          Install StudyOS from your browser’s install menu or “Add to Home
          Screen” after loading it online once.
        </p>
      </section>
      <Suspense fallback={<Loading />}>
        <Portability />
      </Suspense>
    </>
  );
}
