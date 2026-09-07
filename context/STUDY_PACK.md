# Study Pack Contract

Status: **Accepted V1 design**

Implementation: **Not started**

## Purpose

A Study Pack is a portable, provider-neutral package of structured learning content. It lets a user or external generator create material outside StudyOS and import it without giving the browser application model-provider access.

The canonical machine contract will be `study-generator/study-pack.schema.json`. It will use JSON Schema Draft 2020-12 and be validated in the app with Ajv's 2020 implementation. This document explains behavior; the schema is authoritative for file structure once created.

## File identity

- Suggested suffix: `.study.json`
- UTF-8 JSON
- Top-level `formatVersion: 1`
- No executable content, secrets, remote credentials, or embedded HTML
- Pack-local stable IDs connect objects inside the file; import maps them to new application UUIDs
- Source provenance is retained at pack, topic, note, card, and question level where available

## V1 shape

```json
{
  "formatVersion": 1,
  "id": "pack-local-id",
  "title": "Computer Networks",
  "description": "University-level study material",
  "subject": {},
  "topics": [],
  "notes": [],
  "flashcards": [],
  "practiceQuestions": [],
  "relationships": [],
  "references": [],
  "metadata": {}
}
```

Required top-level fields are `formatVersion`, `id`, `title`, `subject`, `topics`, `notes`, `flashcards`, `practiceQuestions`, `relationships`, `references`, and `metadata`. Empty arrays are valid so manually created packs can be narrow.

## Content contracts

### Subject

Pack-local ID, name, optional short name/description/term, suggested color, and learning objectives. Import can create a subject or map the pack to an existing subject.

### Topic

Pack-local ID, optional parent topic ID, title, description/summary, learning objectives, difficulty, importance, estimated effort, prerequisite topic IDs, source references, and stable position.

Topic relationships must be acyclic, reference known topics, and remain inside the pack subject.

### Note

Pack-local ID, title, Markdown, topic IDs, and source references. Raw HTML is rejected or sanitized as untrusted content at render time. Formula content uses documented Markdown math delimiters.

### Flashcard

Pack-local ID, supported card type, topic IDs, front/back or type-specific fields, explanation, tags, source references, and generated metadata. Scheduling state is never imported from a content pack; imported cards begin as new FSRS cards.

### Practice question

Pack-local ID, supported question type, topic IDs, prompt, answer/choices, explanation, rubric, hints, difficulty, tags, and source references. Type-specific invariants are expressed in JSON Schema conditional branches.

### Relationship

Typed edges such as prerequisite, related, contrasts-with, or builds-on between known topic IDs. Relationships inform learning order but cannot override validated topic parentage.

### Reference

Pack-local ID, title, kind, author/publisher/date where known, URL or citation, and optional locator. Source references from content point to this ID and may include page, slide, section, or quoted excerpt. Generated claims should be inspectable; invented provenance is invalid content even if structurally valid.

### Metadata

Creation timestamp, generator name/version if applicable, language, license/right-to-use statement, source description, and optional content fingerprint. Model/provider details are optional provenance, never an app dependency.

## Schema rules

- Use Draft 2020-12 and declare the metaschema.
- Reject unknown `formatVersion` values before preview.
- Prefer `additionalProperties: false` for stable contract objects; reserve a namespaced `extensions` object for future metadata.
- Set explicit string and array size limits to protect memory and UI behavior.
- Validate UUID-like pack IDs as bounded identifiers without requiring them to be application UUIDs.
- Enforce type-specific card/question fields with `oneOf`/`if`/`then` rules.
- JSON Schema validates shape; a second semantic pass validates references, hierarchy cycles, duplicate IDs, source integrity, and application limits.
- Validate the schema itself in CI and validate every example pack against it.

## Import workflow

1. User selects a file; enforce suffix advisory and hard byte limit before parsing.
2. Parse JSON with clear syntax errors.
3. Validate format version and JSON Schema.
4. Run semantic validation: unique IDs, valid references, acyclic topic hierarchy/prerequisites, safe URLs, supported content types, and bounded totals.
5. Calculate a deterministic source fingerprint and obvious duplicate candidates.
6. Show preview: source, content counts, warnings, duplicate matches, and validation errors.
7. Let the user create a subject or choose a compatible existing subject and decide how flagged duplicates are handled.
8. Map every accepted pack-local ID to an application UUID before writing.
9. Write all entities and the successful `ImportRecord` in one Dexie transaction.
10. Show exact results and make imported content immediately available to search, learning, and planning.

Any thrown error aborts the transaction. Failed imports create no academic entities. The UI may retain a safe diagnostic record outside that failed transaction, but never store source content in logs.

## Duplicate handling

V1 detects rather than silently merges:

- exact prior file fingerprint;
- normalized subject/topic path and title;
- normalized card front/type within the target subject;
- normalized question prompt/type within the target subject.

Preview groups candidates and defaults to skipping exact duplicates. The user may explicitly import a separate copy. Fuzzy semantic deduplication is deferred until real data proves it necessary.

## Export

Subject/topic/card/question export uses the same current Study Pack schema and fresh pack-local IDs. Exported content includes source provenance and relationships but excludes:

- FSRS scheduling state and review history;
- practice attempts, sessions, plans, mastery, and readiness history;
- application settings and unrelated subjects;
- locally stored source blobs by default.

Those belong to the full backup format. A user may choose a selected subject or topic subtree and see the exact included counts before download.

## External generator

The later `study-generator/` subsystem will contain:

```text
study-generator/
├── SKILL.md
├── study-pack.schema.json
├── prompts/
├── examples/
└── README.md
```

Its agent skill will analyze supplied sources or research an explicitly requested topic, construct a hierarchy, summaries, cards, questions, prerequisites, estimates, and references, then validate the final file against the schema. Generation can use Codex or another capable harness, but the schema and output stay provider-neutral.

## Acceptance gate

The Study Pack subsystem is complete only when malformed and adversarial fixtures fail clearly, valid examples preview accurately, duplicate choices are honored, failed writes roll back completely, successful content is immediately usable, and exported packs round-trip through a clean profile.

## References

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [Ajv JSON Schema support](https://ajv.js.org/json-schema)
