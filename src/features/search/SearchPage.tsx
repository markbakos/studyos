import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../../db/schema";
import { useQuery } from "../../hooks/useQuery";
import { ErrorMessage } from "../../components/Feedback";
export default function SearchPage() {
  const [params, setParams] = useSearchParams(),
    query = params.get("q") ?? "",
    [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const { data, error } = useQuery(async () => {
    const q = debounced.toLocaleLowerCase().trim();
    if (!q) return [];
    const results = await Promise.all(
      (
        [
          "subjects",
          "topics",
          "exams",
          "assignments",
          "notes",
          "materials",
          "flashcards",
          "questions",
          "tasks",
        ] as const
      ).map(async (kind) =>
        (
          await db
            .records(kind)
            .filter((row) => {
              const values = Object.values(row).filter(
                (v) => typeof v === "string",
              );
              return values.some((v) => v.toLocaleLowerCase().includes(q));
            })
            .limit(20)
            .toArray()
        ).map((row) => ({
          id: row.id,
          kind,
          title:
            "name" in row
              ? row.name
              : "front" in row
                ? row.front
                : "prompt" in row
                  ? row.prompt
                  : row.title,
          href:
            kind === "subjects"
              ? `/subjects/${row.id}`
              : kind === "flashcards"
                ? `/flashcards?q=${encodeURIComponent("front" in row ? row.front : "")}`
                : kind === "questions"
                  ? `/practice?question=${row.id}`
                  : kind === "tasks"
                    ? "/study"
                    : `/subjects/${"subjectId" in row ? row.subjectId : ""}?tab=${kind === "materials" ? "notes" : kind}`,
        })),
      ),
    );
    return results.flat();
  }, [debounced]);
  return (
    <>
      <p className="eyebrow">FIND YOUR NEXT CONNECTION</p>
      <h1>Search your workspace</h1>
      <label className="global-search">
        <span className="sr-only">Search everything</span>
        <input
          type="search"
          placeholder="Topics, notes, questions, deadlines…"
          value={query}
          onChange={(e) => setParams({ q: e.target.value }, { replace: true })}
        />
      </label>
      <ErrorMessage message={error} />
      <div className="panel">
        <h2>{query ? "Search results" : "Jump to a workspace"}</h2>
        {!query ? (
          <div className="more-links">
            <Link to="/study">Start studying</Link>
            <Link to="/subjects">Your subjects</Link>
            <Link to="/settings">Import a Study Pack</Link>
            <Link to="/calendar?tab=availability">Adjust availability</Link>
          </div>
        ) : data?.length ? (
          data.map((result) => (
            <Link
              className="search-result"
              key={`${result.kind}:${result.id}`}
              to={result.href}
            >
              <span>{result.title}</span>
              <span className="badge">{result.kind}</span>
            </Link>
          ))
        ) : (
          <p className="muted">No matches. Try another phrase.</p>
        )}
        <p className="small muted">
          Search returns up to 20 matches per category. Everything stays on this
          device.
        </p>
      </div>
    </>
  );
}
