---
name: generate-study-pack
description: Generate a portable StudyOS Study Pack from authorized sources or an explicitly requested research topic.
---

# Generate a Study Pack

1. Read `study-pack.schema.json` fully. Collect the user's learning goal, level, deadline if supplied, and authorized sources.
2. For supplied-source work, inspect those sources. For topic-only work, research authoritative sources and record exact references. Never invent source provenance or imply generated questions were quoted from a source.
3. Build an acyclic topic hierarchy with stable pack-local IDs, realistic minute estimates, importance, difficulty, and explicit prerequisites. Prerequisite edges point from dependent to prerequisite.
4. Write concise notes in safe Markdown, retrieval flashcards with complete front/back text, and varied practice questions. Include answers, explanations, and rubrics for subjective questions. Programming is self-assessed; never include code execution instructions in an app workflow.
5. Preserve reference IDs on generated content. Set metadata language, creation time, rights statement, and source description. Distinguish source facts from your original exercises.
6. Validate with the canonical Draft 2020-12 schema and StudyOS semantic validation: `npm run validate:pack -- path/to/file.study.json`. Fix every error before delivery.
7. Deliver the file and mention any content limitations. The user imports it through Settings, reviews counts and duplicate choices, and explicitly confirms import.

Do not include model credentials, scheduling state, personal study history, executable HTML, or unverified citations. No provider-specific dependency is required.
