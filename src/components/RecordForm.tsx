import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { ErrorMessage } from "./Feedback";
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "time"
    | "datetime-local"
    | "color"
    | "textarea"
    | "select"
    | "checkbox";
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
};
export function RecordForm({
  fields,
  initial = {},
  onSave,
  onCancel,
  submitLabel = "Save",
  children,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<unknown>;
  onCancel?: () => void;
  submitLabel?: string;
  children?: ReactNode;
}) {
  const [error, setError] = useState(""),
    [pending, start] = useTransition(),
    dirty = useRef(false);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return (
    <form
      className="record-form"
      autoComplete="off"
      onChange={() => {
        dirty.current = true;
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const values = Object.fromEntries(
          fields.map((field) => [
            field.name,
            field.type === "checkbox"
              ? data.has(field.name)
              : field.type === "number"
                ? Number(data.get(field.name))
                : String(data.get(field.name) ?? ""),
          ]),
        );
        setError("");
        start(async () => {
          try {
            await onSave(values);
            dirty.current = false;
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Could not save. Please try again.",
            );
          }
        });
      }}
    >
      <div className="form-grid">
        {fields.map((field) => {
          const value = initial[field.name] ?? field.defaultValue ?? "";
          return (
            <label
              key={field.name}
              className={field.type === "textarea" ? "wide" : ""}
            >
              <span>{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  defaultValue={String(value)}
                  required={field.required}
                  maxLength={100000}
                  rows={5}
                />
              ) : field.type === "select" ? (
                <select
                  name={field.name}
                  defaultValue={String(value)}
                  required={field.required}
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={
                    field.type === "checkbox" ? undefined : String(value)
                  }
                  defaultChecked={
                    field.type === "checkbox" ? Boolean(value) : undefined
                  }
                  required={field.required}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  maxLength={10000}
                />
              )}
            </label>
          );
        })}
      </div>
      {children}
      <ErrorMessage message={error} />
      <div className="button-row">
        <button className="primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={() => {
              if (
                !dirty.current ||
                window.confirm("Discard your unsaved changes?")
              )
                onCancel();
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
