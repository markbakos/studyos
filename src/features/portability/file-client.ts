import type { StudyPack } from "./pack-schema";
import type { Backup } from "./validation";
import type { Snapshot } from "../../types/model";
export function readFile(
  file: File,
  kind: "pack",
  signal: AbortSignal,
): Promise<StudyPack>;
export function readFile(
  file: File,
  kind: "backup",
  signal: AbortSignal,
): Promise<{ backup: Backup; data: Snapshot }>;
export async function readFile(
  file: File,
  kind: "pack" | "backup",
  signal: AbortSignal,
) {
  if (file.size > (kind === "pack" ? 10 : 100) * 1024 * 1024)
    throw new Error(`File exceeds the ${kind === "pack" ? 10 : 100} MB limit.`);
  const text = await file.text();
  if (signal.aborted) throw new Error("Cancelled");
  return new Promise<StudyPack | { backup: Backup; data: Snapshot }>(
    (resolve, reject) => {
      const worker = new Worker(new URL("./file.worker.ts", import.meta.url), {
        type: "module",
      });
      const clean = () => {
        worker.terminate();
        signal.removeEventListener("abort", cancel);
      };
      const cancel = () => {
        clean();
        reject(new Error("Cancelled"));
      };
      signal.addEventListener("abort", cancel, { once: true });
      worker.onerror = () => {
        clean();
        reject(
          new Error("File validation failed. Try selecting the file again."),
        );
      };
      worker.onmessage = (event) => {
        clean();
        if (event.data.type === "error") reject(new Error(event.data.error));
        else resolve(event.data.result);
      };
      worker.postMessage({ kind, text });
    },
  );
}
