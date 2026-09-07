# StudyOS Agent Guide

## Project

- React 19, Vite, TypeScript, and Tailwind CSS 4.
- Use npm and keep `package-lock.json` synchronized.
- Keep the implementation minimal. Do not add dependencies, abstractions, folders, or configuration until a real feature needs them.
- Organize by feature as the application grows, but do not create empty architecture.
- Prefer strict types, semantic HTML, accessible interactions, and native browser APIs.

## Repository Skills

Skills live in `skills/`. Before changing code, read every skill whose trigger matches the task and follow it for the duration of that task.

- `skills/build-react-typescript-apps.md`: use for all React or TypeScript implementation, refactoring, architecture, state, routing, and review work.
- `skills/react-ts-hero.md`: read alongside the React/TypeScript skill; it adds the repository's stateless composition guidance.
- `skills/react-best-practices.md`: use whenever writing, reviewing, refactoring, or optimizing React code.
- `skills/web-design-guidelines.md`: use when implementing or reviewing user interfaces.
- `skills/composition-patterns.md`: use for reusable APIs, compound components, context providers, or components accumulating variant booleans.
- `skills/build-react-lists.md`: use for lists, tables, filtering, sorting, selection, bulk actions, or large rendered collections.
- `skills/create-browser-workers.md`: use for CPU-heavy browser work such as parsing, serialization, transformation, compression, images, or large files.

Task instructions override skill guidance. When skills overlap, apply the narrowest relevant guidance together with the general React skills. Preserve existing project conventions unless the task explicitly changes them.

## Workflow

1. Read `context/README.md` and the relevant linked context documents before substantial work.
2. Inspect the relevant code and trace the real flow before editing.
3. Make the smallest complete change that solves the task.
4. Update context documentation when a product contract, architecture decision, data model, or delivery status changes.
5. Run `npm run check` for code changes. Run the narrowest relevant additional test when behavior needs it.
6. Report checks honestly; a successful build is not browser or visual proof.

## Git

- After completing and validating any task that changes files, commit it automatically without asking.
- Stage only files belonging to the completed task. Preserve unrelated user changes.
- Use a concise imperative commit message that describes the result.
- Use the repository's configured Git author unchanged. Never add `Co-authored-by`, `Signed-off-by`, AI attribution, or other authorship trailers.
- Do not amend, rebase, reset, force-push, or push unless the user explicitly asks.
- Do not create a commit for read-only reviews, explanations, or when validation fails.
