import { z } from "zod";
const id = z.string().min(1).max(200);
const text = z.string().max(100000);
const title = z.string().min(1).max(300);
const ids = z.array(id).max(10000);
const content = {
  id,
  topicIds: ids,
  sourceReferences: ids,
  tags: z.array(z.string().max(100)).max(100),
};
export const packSchema = z
  .object({
    formatVersion: z.literal(1),
    id,
    title,
    description: text.optional(),
    subject: z
      .object({
        id,
        name: title,
        shortName: text.optional(),
        description: text.optional(),
        term: text.optional(),
        color: z.string().regex(/^#[\da-fA-F]{6}$/),
        learningObjectives: z.array(text).max(100),
      })
      .strict(),
    topics: z
      .array(
        z
          .object({
            id,
            title,
            parentTopicId: id.optional(),
            description: text,
            learningObjectives: z.array(text).max(100),
            difficulty: z.number().int().min(1).max(5),
            importance: z.number().int().min(1).max(5),
            estimatedMinutes: z.number().min(0).max(100000),
            prerequisiteTopicIds: ids,
            sourceReferences: ids,
            position: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(5000),
    notes: z
      .array(
        z
          .object({
            id,
            title,
            markdown: text,
            topicIds: ids,
            sourceReferences: ids,
          })
          .strict(),
      )
      .max(5000),
    flashcards: z
      .array(
        z
          .object({
            ...content,
            type: z.enum([
              "basic",
              "reversible",
              "cloze",
              "typed",
              "multiple choice",
              "definition",
              "code",
            ]),
            front: z.string().min(1).max(10000),
            back: z.string().min(1).max(10000),
            explanation: text,
          })
          .strict(),
      )
      .max(20000),
    practiceQuestions: z
      .array(
        z
          .object({
            ...content,
            type: z.enum([
              "multiple choice",
              "true/false",
              "short answer",
              "long answer",
              "numeric",
              "programming",
              "essay",
              "custom",
            ]),
            prompt: z.string().min(1).max(10000),
            expectedAnswer: text,
            choices: z.array(z.object({ id, text: title }).strict()).max(20),
            correctChoiceIds: ids,
            explanation: text,
            rubric: text,
            hints: z.array(text).max(20),
            difficulty: z.number().int().min(1).max(5),
          })
          .strict(),
      )
      .max(20000),
    relationships: z
      .array(
        z
          .object({
            fromTopicId: id,
            toTopicId: id,
            type: z.enum([
              "prerequisite",
              "related",
              "contrasts-with",
              "builds-on",
            ]),
          })
          .strict(),
      )
      .max(20000),
    references: z
      .array(
        z
          .object({
            id,
            title,
            kind: title,
            url: z.string().max(2000).optional(),
            citation: text.optional(),
            locator: text.optional(),
          })
          .strict(),
      )
      .max(5000),
    metadata: z
      .object({
        createdAt: z.iso.datetime(),
        generator: title.optional(),
        language: z.string().max(50),
        license: text,
        sourceDescription: text,
        extensions: z.record(z.string(), z.string().max(1000)).optional(),
      })
      .strict(),
  })
  .strict();
export type StudyPack = z.infer<typeof packSchema>;
