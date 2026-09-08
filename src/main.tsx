import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initialize } from "./db/schema";

const root = createRoot(document.getElementById("root")!);
initialize()
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch(() =>
    root.render(
      <main>
        <h1>Local storage could not open</h1>
        <p>
          Allow browser storage and reload to retry. Your existing data has not
          been cleared.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>,
    ),
  );
