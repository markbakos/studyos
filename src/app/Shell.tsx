import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import { db } from "../db/schema";
import { useQuery } from "../hooks/useQuery";
import { replan } from "../features/planning/service";
import { today } from "../engine/dates";
import { ErrorMessage } from "../components/Feedback";
export default function Shell() {
  const navigate = useNavigate(),
    location = useLocation(),
    [isOnline, setOnline] = useState(navigator.onLine),
    [error, setError] = useState("");
  const { data: settings } = useQuery(() =>
    db.records("settings").get("settings"),
  );
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        settings?.theme === "dark" ||
        (settings?.theme !== "light" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#171a22" : "#f6f7fb");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings?.theme]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        navigate("/search");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
  useEffect(() => {
    const handle = () => {
      setOnline(navigator.onLine);
      if (document.visibilityState === "visible")
        void replan("Workspace reopened", today()).catch((e) =>
          setError(String(e)),
        );
    };
    window.addEventListener("online", handle);
    window.addEventListener("offline", handle);
    document.addEventListener("visibilitychange", handle);
    const timer = setInterval(handle, 60000);
    handle();
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", handle);
      window.removeEventListener("offline", handle);
      document.removeEventListener("visibilitychange", handle);
    };
  }, []);
  useEffect(() => {
    document.getElementById("main")?.focus();
    document.title = `${location.pathname.split("/")[1] || "Today"} · StudyOS`;
  }, [location.pathname]);
  const reminder =
    settings?.backupReminderDays &&
    (!settings.lastBackup ||
      Date.now() - Date.parse(settings.lastBackup) >
        settings.backupReminderDays * 86400000);
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink className="brand" to="/">
          <span className="brand-mark">S</span>Study
          <span className="muted">OS</span>
        </NavLink>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Primary navigation">
          <NavLink to="/" end>
            <span aria-hidden="true">◉</span>Today
          </NavLink>
          <NavLink to="/calendar">
            <span aria-hidden="true">▦</span>Calendar
          </NavLink>
          <NavLink to="/subjects">
            <span aria-hidden="true">▤</span>Subjects
          </NavLink>
          <NavLink to="/study">
            <span aria-hidden="true">▷</span>Study
          </NavLink>
          <NavLink to="/flashcards">
            <span aria-hidden="true">▱</span>Flashcards
          </NavLink>
          <NavLink to="/practice">
            <span aria-hidden="true">✓</span>Practice
          </NavLink>
          <NavLink to="/progress">
            <span aria-hidden="true">↗</span>Progress
          </NavLink>
          <NavLink to="/search">
            <span aria-hidden="true">⌕</span>Search <kbd>⌘ K</kbd>
          </NavLink>
          <NavLink to="/settings">
            <span aria-hidden="true">⚙</span>Settings
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          Local workspace<p>Your learning stays on this device.</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="muted">Your space to make progress.</span>
          <span className="badge">
            {isOnline
              ? "Saved on this device"
              : "Offline · local data available"}
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <ErrorMessage message={error} />
          {needRefresh ? (
            <div className="notice">
              An update is ready. Save your edits and pause your session first.{" "}
              <button
                onClick={async () => {
                  if (
                    await db
                      .records("sessions")
                      .where("state")
                      .equals("active")
                      .count()
                  ) {
                    setError("Pause your active session before updating.");
                    return;
                  }
                  if (
                    window.confirm(
                      "Reload the application? Save any open edits first.",
                    )
                  )
                    void updateServiceWorker(true);
                }}
              >
                Update & reload
              </button>
            </div>
          ) : null}
          {reminder ? (
            <div className="notice">
              Your backup reminder is due.{" "}
              <NavLink to="/settings">Create a backup</NavLink>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/" end>
          Today
        </NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <NavLink to="/study">Study</NavLink>
        <NavLink to="/subjects">Subjects</NavLink>
        <NavLink to="/more">More</NavLink>
      </nav>
    </div>
  );
}
