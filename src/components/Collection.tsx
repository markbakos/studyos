import { createContext, use, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
const Context = createContext<
  | { query: string; page: number; set: (key: string, value: string) => void }
  | undefined
>(undefined);
function useCollection() {
  const value = use(Context);
  if (!value) throw new Error("Collection controls need a provider.");
  return value;
}
export function Root({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const set = (key: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, value);
        if (key === "q") next.delete("page");
        return next;
      },
      { replace: true },
    );
  };
  return (
    <Context
      value={{
        query: params.get("q") ?? "",
        page: Math.max(0, Number(params.get("page")) || 0),
        set,
      }}
    >
      {children}
    </Context>
  );
}
export function Search() {
  const { query, set } = useCollection();
  return (
    <label className="search-field">
      <span className="sr-only">Filter collection</span>
      <input
        type="search"
        placeholder="Filter this collection…"
        value={query}
        onChange={(e) => set("q", e.target.value)}
      />
    </label>
  );
}
export function Items<T extends { id: string }>({
  items,
  text,
  children,
}: {
  items: readonly T[];
  text: (item: T) => string;
  children: (item: T) => ReactNode;
}) {
  const { query, page, set } = useCollection(),
    filtered = items.filter((item) =>
      text(item).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 30) - 1),
  );
  return (
    <>
      <p className="muted small">{filtered.length} results</p>
      <div className="collection">
        {filtered.slice(current * 30, current * 30 + 30).map((item) => (
          <div key={item.id} className="collection-item">
            {children(item)}
          </div>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="muted">
          No matching items. Add one or clear your filter.
        </p>
      ) : null}
      {filtered.length > 30 ? (
        <div className="button-row">
          <button
            disabled={!current}
            onClick={() => set("page", String(current - 1))}
          >
            Previous
          </button>
          <span>Page {current + 1}</span>
          <button
            disabled={(current + 1) * 30 >= filtered.length}
            onClick={() => set("page", String(current + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}
