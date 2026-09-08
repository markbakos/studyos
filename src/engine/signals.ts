import type { Snapshot, Topic } from "../types/model";
const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function mastery(topic: Topic, data: Snapshot, now: string) {
  const cards = data.flashcards.filter((c) => c.topicIds.includes(topic.id));
  const cardIds = new Set(cards.map((c) => c.id));
  const questionIds = new Set(
    data.questions
      .filter((q) => q.topicIds.includes(topic.id))
      .map((q) => q.id),
  );
  const reviews = data.reviews
    .filter((r) => cardIds.has(r.flashcardId))
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
    .slice(-30);
  const attempts = data.attempts
    .filter((a) => questionIds.has(a.questionId))
    .sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt))
    .slice(-30);
  const recall = average(reviews.map((r) => (r.rating - 1) / 3));
  const practice = average(
    attempts.map((a) => a.score * (a.usedHint ? 0.75 : 1)),
  );
  const evidenceCount = reviews.length + attempts.length;
  const latest = [
    ...reviews.map((r) => r.reviewedAt),
    ...attempts.map((a) => a.attemptedAt),
  ]
    .sort()
    .at(-1);
  const recency = latest
    ? clamp(1 - (Date.parse(now) - Date.parse(latest)) / (30 * 86400000))
    : 0;
  const confidence = Math.min(1, evidenceCount / 10);
  const observed =
    reviews.length && attempts.length
      ? recall * 0.45 + practice * 0.55
      : reviews.length
        ? recall
        : practice;
  const score = evidenceCount
    ? clamp(
        observed * 0.85 * (0.5 + confidence * 0.5) +
          recency * 0.1 +
          (topic.manualConfidence ?? 0) * 0.05,
      )
    : 0;
  return {
    score,
    recall,
    practice,
    recency,
    confidence,
    evidenceCount,
    band: !evidenceCount
      ? "No evidence yet"
      : score < 0.4
        ? "Building foundations"
        : score < 0.7
          ? "Developing"
          : "Strong",
    reasons: [
      `${reviews.length} reviews and ${attempts.length} attempts`,
      `${Math.round(confidence * 100)}% evidence confidence`,
      "Study signal, not a grade prediction",
    ],
  };
}
export function readiness(examId: string, data: Snapshot, now: string) {
  const links = data.examTopics.filter((t) => t.examId === examId);
  const topics = links.flatMap((link) => {
    const topic = data.topics.find((t) => t.id === link.topicId);
    return topic
      ? [{ topic, weight: link.weight, signal: mastery(topic, data, now) }]
      : [];
  });
  const totalWeight = topics.reduce((n, t) => n + t.weight, 0) || 1;
  const weighted = (key: "score" | "recall" | "practice" | "recency") =>
    topics.reduce((n, t) => n + t.signal[key] * t.weight, 0) / totalWeight;
  const coverage =
    topics
      .filter((t) => t.signal.evidenceCount > 0)
      .reduce((n, t) => n + t.weight, 0) / totalWeight;
  return {
    score: weighted("score") * 0.8 + coverage * 0.2,
    coverage,
    recall: weighted("recall"),
    practice: weighted("practice"),
    recency: weighted("recency"),
    remainingMinutes: data.tasks
      .filter(
        (t) =>
          t.examId === examId && ["planned", "in progress"].includes(t.state),
      )
      .reduce((n, t) => n + t.estimatedMinutes, 0),
    weakestTopicIds: topics
      .sort((a, b) => a.signal.score - b.signal.score)
      .slice(0, 3)
      .map((t) => t.topic.id),
    reasons: [
      `${topics.filter((t) => t.signal.evidenceCount).length}/${topics.length} topics have learning evidence`,
      "80% weighted mastery, 20% topic coverage",
      "Readiness is not an exam grade prediction",
    ],
  };
}
