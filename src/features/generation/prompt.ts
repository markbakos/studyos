export type PromptKind =
  "complete" | "structure" | "notes" | "flashcards" | "practice";

export const promptKinds: { value: PromptKind; label: string }[] = [
  { value: "complete", label: "Complete study pack" },
  { value: "structure", label: "Subject & topic structure" },
  { value: "notes", label: "Study notes" },
  { value: "flashcards", label: "Flashcards" },
  { value: "practice", label: "Practice questions" },
];

const tasks: Record<PromptKind, string> = {
  complete:
    "Create a complete learning pack: a useful topic hierarchy, concise notes, varied retrieval flashcards, and varied practice questions.",
  structure:
    "Create the subject and a complete, acyclic topic hierarchy with objectives, prerequisites, difficulty, importance, and realistic study-time estimates. Leave notes, flashcards, and practiceQuestions empty.",
  notes:
    "Create the supporting topic hierarchy and clear study notes. Leave flashcards and practiceQuestions empty.",
  flashcards:
    "Create the supporting topic hierarchy and a strong batch of retrieval flashcards. Use varied supported card types where they improve learning. Leave notes and practiceQuestions empty.",
  practice:
    "Create the supporting topic hierarchy and a varied batch of practice questions with answers, explanations, hints, and rubrics where applicable. Leave notes and flashcards empty.",
};

export interface PromptInput {
  kind: PromptKind;
  subject: string;
  level: string;
  goal: string;
  topics: string;
  sourceInstructions: string;
  amount: string;
  existingTopics: string[];
  language: string;
  schema: unknown;
}

export function createStudyPackPrompt(input: PromptInput) {
  const context = [
    `Subject: ${input.subject.trim()}`,
    `Learner level: ${input.level.trim() || "Use the level implied by the request and sources."}`,
    `Learning goal: ${input.goal.trim()}`,
    `Requested scope/topics: ${input.topics.trim() || "Cover the subject according to the learning goal."}`,
    `Requested amount/depth: ${input.amount.trim() || "Choose enough content for useful coverage without repetition."}`,
    `Output language: ${input.language.trim() || "Use the language of the request."}`,
    input.existingTopics.length
      ? `Topics already in StudyOS; reuse these titles and hierarchy where relevant: ${input.existingTopics.join(", ")}`
      : "No existing StudyOS topics were supplied.",
    `Source instructions: ${input.sourceInstructions.trim() || "Use reliable sources and clearly identify them. If no files are attached, use authoritative sources you can accurately cite."}`,
  ].join("\n");

  return `You are creating import-ready learning content for StudyOS.

TASK
${tasks[input.kind]}

LEARNER REQUEST
${context}

SOURCE RULES
- Inspect every file attached to this chat, including PDFs, slides, notes, or a syllabus, and prioritize them over general knowledge.
- Cite actual attached files with useful page, slide, chapter, or section locators when available.
- Add only references you really used. Never invent a title, URL, quotation, locator, or source.
- Write original study questions and flashcards; do not imply they were quoted from a source.
- If the sources are incomplete or conflict, make the uncertainty clear in the content instead of guessing.

OUTPUT RULES
- Return exactly one raw JSON object and nothing else. Do not use Markdown fences or add commentary.
- The object must validate against the JSON Schema below. Include every required field and required array, using empty arrays for intentionally excluded content.
- Use short, unique pack-local string IDs and reference only IDs that exist in the same object.
- Keep topic parent and prerequisite relationships acyclic. A prerequisite edge points from the dependent topic to its prerequisite.
- Every note, card, and question must reference relevant topic IDs from this pack when possible.
- Use $inline$ or $$display$$ for math. Do not include raw HTML, model credentials, schedules, review history, or personal study history.
- Set metadata.createdAt to the current ISO 8601 time, metadata.generator to your model name, metadata.language to the requested language, and metadata.license/sourceDescription truthfully.
- Before answering, silently check the final object against the schema and fix every structural or reference error.

JSON SCHEMA
${JSON.stringify(input.schema, null, 2)}`;
}
