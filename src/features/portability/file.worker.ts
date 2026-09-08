/// <reference lib="webworker" />
import { validateBackup, validatePack } from "./validation";
self.onmessage = async (
  event: MessageEvent<{ kind: "pack" | "backup"; text: string }>,
) => {
  try {
    if (
      !event.data ||
      !["pack", "backup"].includes(event.data.kind) ||
      typeof event.data.text !== "string"
    )
      throw new Error("Invalid file request.");
    const input: unknown = JSON.parse(event.data.text);
    const result =
      event.data.kind === "pack"
        ? validatePack(input)
        : await validateBackup(input);
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      error:
        error instanceof Error ? error.message : "Could not validate file.",
    });
  }
};
