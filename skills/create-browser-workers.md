---
name: create-browser-workers
description: Create robust browser Web Workers for CPU-heavy parsing, serialization, transformation, and file processing, with typed message protocols, chunking, progress reporting, transferable data, cancellation, error handling, and cleanup. Use when implementing CSV, spreadsheet, image, compression, or similar background work in any browser or React project.
---

# Create Browser Web Workers

Inspect the project's bundler, TypeScript setup, module conventions, and browser targets first. Use a worker only for work expensive enough to block the main thread; keep ordinary UI and network orchestration outside it.

## Separate responsibilities

Create three layers and adapt their locations to the project:

```text
workers/csv.worker.ts       # parsing and serialization
lib/csv-worker-client.ts    # Promise-based worker adapter
components/CsvImport.tsx    # UI, progress, and user interaction
```

Keep the worker independent of React and DOM APIs. Keep file pickers, downloads, notifications, and application state on the main thread.

## Define the protocol first

Use typed, discriminated messages in both directions:

- Requests: `start`, `chunk`, `finish`, `cancel`, or operation-specific commands.
- Responses: `progress`, `result`, `error`, and optionally `cancelled`.

Include a job ID when a worker can handle more than one operation. Make progress units explicit, such as processed rows, processed bytes, or a percentage.

## Implement the worker

Add the web-worker library reference when TypeScript configuration requires it:

```ts
/// <reference lib="webworker" />
```

- Validate incoming messages before processing them.
- Process large inputs in bounded chunks and report progress between chunks.
- Catch failures and return serializable error details.
- Reset mutable module state after completion, cancellation, or failure.
- Check for cancellation between expensive chunks.
- Transfer ownership of large `ArrayBuffer` objects when the sender no longer needs them.
- Avoid sending functions, DOM nodes, class instances, or other non-cloneable values.

For CSV work, implement correct quoting, doubled quotes, delimiters inside quoted fields, multiline fields, Unicode, configurable delimiters, and optional headers. Never parse CSV with a naive `split(",")`.

## Build the client adapter

Instantiate the worker using the bundler's supported form, for example:

```ts
const worker = new Worker(
    new URL("../workers/csv.worker.ts", import.meta.url),
    { type: "module" },
);
```

Use a bundler-specific worker import only when the project already follows that convention.

Wrap the worker in a Promise-based or task-based API. Forward progress callbacks, resolve only on the final result, reject on protocol or runtime errors, and terminate the worker on every terminal path. Expose cancellation when operations may take noticeable time.

Create one worker per isolated job unless measurements justify a reusable pool. Do not share mutable worker state across concurrent jobs without job IDs and explicit isolation.

## Integrate the UI

- Keep React components limited to collecting input, starting or cancelling work, showing progress, and consuming results.
- Disable duplicate submissions while a non-concurrent job is active.
- Revoke generated object URLs after downloads.
- Terminate active workers when the owning component or task is disposed.

Verify success, malformed input, cancellation, worker exceptions, cleanup, progress monotonicity, Unicode, empty files, and inputs large enough to confirm the main thread remains responsive.
