import { z } from 'zod';

import type { SttProviderId } from './providers/types.js';

export const sectionsSchema = z.object({
  objective: z.string().optional(),
  context: z.string().optional(),
  instructions: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),
  stepsToReproduce: z.array(z.string()).optional(),
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
