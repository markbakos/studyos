import { useEffect, useState } from "react";
import { liveQuery } from "dexie";

export function useQuery<T>(
  query: () => Promise<T>,
  dependencies: readonly unknown[] = [],
) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (data) => setResult({ data }),
      error: (error: unknown) =>
        setResult({
          error:
            error instanceof Error
              ? error.message
              : "Could not read local data. Reload to retry.",
        }),
    });
    return () => subscription.unsubscribe();
    // The caller supplies query keys, just as for a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return result;
}
