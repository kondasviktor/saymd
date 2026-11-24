import { z } from 'zod';

const stringList = z
  .union([z.array(z.string()), z.string()])
  .transform((v) => (Array.isArray(v) ? v : [v]))
  .optional();

export const sectionsSchema = z.object({
  objective: z.string().optional(),
  context: z.string().optional(),
  acceptanceCriteria: stringList,
  openQuestions: stringList,
  stepsToReproduce: stringList,
  instructions: stringList,
  constraints: stringList,
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
});

export type SaymdSections = z.infer<typeof sectionsSchema>;

export type TemplateId = 'default' | 'feature' | 'bug' | 'plan';
