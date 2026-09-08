import {
  createEmptyCard,
  fsrs,
  FSRSVersion,
  type Card,
  type Grade,
} from "ts-fsrs";
import { fsrsSchema, type Records } from "../types/model";
const scheduler = fsrs({ enable_fuzz: false });
const serialize = (card: Card) =>
  fsrsSchema.parse({
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  });
export const newCardState = (now = new Date().toISOString()) =>
  serialize(createEmptyCard(now));
export function scheduleReview(
  card: Records["flashcards"],
  rating: Grade,
  now: string,
) {
  const result = scheduler.next(card.fsrsState, now, rating);
  return { state: serialize(result.card), version: FSRSVersion };
}
export function gradeAnswer(
  question: Records["questions"],
  answer: string,
): number | undefined {
  if (question.type === "multiple choice") {
    const selected = answer.split(",").filter(Boolean).sort();
    return JSON.stringify(selected) ===
      JSON.stringify([...question.correctChoiceIds].sort())
      ? 1
      : 0;
  }
  if (question.type === "numeric")
    return answer.trim() &&
      Number.isFinite(Number(answer)) &&
      Number(answer) === Number(question.expectedAnswer)
      ? 1
      : 0;
  if (question.type === "true/false")
    return answer.trim().toLowerCase() ===
      question.expectedAnswer.trim().toLowerCase()
      ? 1
      : 0;
  return undefined;
}
export function elapsedSeconds(session: Records["sessions"], now: string) {
  return (
    session.elapsedSeconds +
    (session.state === "active" && session.runningSince
      ? Math.max(0, (Date.parse(now) - Date.parse(session.runningSince)) / 1000)
      : 0)
  );
}
