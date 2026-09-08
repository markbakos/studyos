# Study Pack generator

Generate content outside the browser using [SKILL.md](SKILL.md), then validate against [study-pack.schema.json](study-pack.schema.json). StudyOS never calls a model provider.

Use an authorized source or research a clearly requested topic. Record actual citations, distinguish your summaries from source quotations, and do not invent references. Save UTF-8 JSON as `name.study.json`. Import from Settings to preview and use the content.

The schema is generated from `src/features/portability/pack-schema.ts` with `npm run schemas`. All fields are bounded. Topic prerequisites point from the dependent topic to its prerequisite. Source references are reference IDs. Math uses `$inline$` or `$$display$$` delimiters. Raw HTML is not rendered. Multiple choice practice uses choice IDs; numeric answers use finite decimal strings. Written answers are self-assessed. Card front/back fields contain the full prompt and answer, including any choices or cloze blanks.

Validate locally with `npm run validate:pack -- path/to/file.study.json`. Schema validation is followed by references, cycle, and semantic validation. Scheduling and learning history never belong in a content pack.

The StudyOS Create With AI screen can build a task-specific prompt containing the current schema. Paste that prompt into any capable model, attach source files in that chat, then paste the model's raw JSON response back into StudyOS for validation and import.
