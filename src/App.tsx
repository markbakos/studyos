import { lazy, Suspense, Component, type ReactNode } from "react";
import { HashRouter, Link, Route, Routes } from "react-router-dom";
import Shell from "./app/Shell";
import { Loading } from "./components/Feedback";
const Today = lazy(() => import("./features/planning/TodayPage"));
const Subjects = lazy(() => import("./features/academic/SubjectsPage"));
const Subject = lazy(() => import("./features/academic/SubjectPage"));
const Calendar = lazy(() => import("./features/academic/CalendarPage"));
const Study = lazy(() => import("./features/learning/StudyPage"));
const Cards = lazy(() => import("./features/learning/FlashcardsPage"));
const Practice = lazy(() => import("./features/learning/PracticePage"));
const Progress = lazy(() => import("./features/learning/ProgressPage"));
const Settings = lazy(() => import("./features/settings/SettingsPage"));
const Search = lazy(() => import("./features/search/SearchPage"));
const Create = lazy(() => import("./features/generation/CreatePage"));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main>
        <h1>Could not open StudyOS</h1>
        <p>Your stored data has not been cleared. Reload to retry.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Today />} />
              <Route path="subjects" element={<Subjects />} />
              <Route path="subjects/:id" element={<Subject />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="study" element={<Study />} />
              <Route path="flashcards" element={<Cards />} />
              <Route path="practice" element={<Practice />} />
              <Route path="progress" element={<Progress />} />
              <Route path="settings" element={<Settings />} />
              <Route path="search" element={<Search />} />
              <Route path="create" element={<Create />} />
              <Route
                path="more"
                element={
                  <>
                    <h1>Your workspace</h1>
                    <div className="more-links">
                      <Link to="/flashcards">Flashcards</Link>
                      <Link to="/practice">Practice</Link>
                      <Link to="/progress">Progress</Link>
                      <Link to="/create">Create With AI</Link>
                      <Link to="/search">Search</Link>
                      <Link to="/settings">Settings & Study Packs</Link>
                    </div>
                  </>
                }
              />
              <Route
                path="*"
                element={
                  <>
                    <h1>Page not found</h1>
                    <Link to="/">Back to Today</Link>
                  </>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </ErrorBoundary>
  );
}
