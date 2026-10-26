import { z } from 'zod';

import type { SttProviderId } from './providers/types.js';

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

export interface SaymdResult {
  raw: string;
  clean: string;
  language: string;
  sections: SaymdSections;
  markdown: string;
  durationSeconds: number;
  estimatedCostUsd: number;
  provider: SttProviderId;
  sttModel: string;
}

export type TemplateId = 'default' | 'feature' | 'bug' | 'plan';

export interface CliOptions {
  file?: string;
  provider?: SttProviderId;
  template: TemplateId;
  output: string;
  lang?: string;
  outLang?: string;
  raw: boolean;
  stdout: boolean;
  clipboard: boolean;
  json: boolean;
  diff: boolean;
  dryRun: boolean;
  continue?: string;
  review?: string;
  recordSeconds: number;
}
