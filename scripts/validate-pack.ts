import { readFileSync } from "node:fs";
import { validatePack } from "../src/features/portability/validation";
const file = process.argv[2];
if (!file) throw new Error("Usage: npm run validate:pack -- file.study.json");
const pack = validatePack(JSON.parse(readFileSync(file, "utf8")));
console.log(
  `Valid: ${pack.title}; ${pack.topics.length} topics, ${pack.flashcards.length} cards, ${pack.practiceQuestions.length} questions.`,
);
