import { useState, useTransition, type ReactNode } from "react";
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true" className="empty-symbol">
        ✧
      </span>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <p role="status" className="muted">
      Loading your workspace…
    </p>
  );
}
export function ErrorMessage({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null;
}
export function Action({
  onAction,
  children,
  className = "",
  disabled = false,
}: {
  onAction: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState("");
  return (
    <span className="action">
      <button
        className={className}
        disabled={pending || disabled}
        onClick={() => {
          setError("");
          start(async () => {
            try {
              await onAction();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not save. Try again.",
              );
            }
          });
        }}
      >
        {pending ? "Saving…" : children}
      </button>
      <ErrorMessage message={error} />
    </span>
  );
}
