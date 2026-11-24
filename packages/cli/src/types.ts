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

export interface SplitTask {
  slug: string;
  title: string;
  depends_on: string[];
  sections: SaymdSections;
}

export interface PathSummary {
  found: string[];
  newFiles: string[];
  missing: string[];
}

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
  /** Pro --split: ordered draft tasks (numbered when written). */
  tasks?: SplitTask[];
  summary?: string;
  /** Pro --ground: @path check against disk. */
  paths?: PathSummary;
}

export type TemplateId = 'default' | 'feature' | 'bug' | 'plan';

export interface CliOptions {
  file?: string;
  provider?: SttProviderId;
  /** STT model override, e.g. gpt-4o-mini-transcribe. */
  model?: string;
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
  /** Pro: task directory for --split (default .ai/tasks). */
  split?: string;
  /** Pro: ground the spec in a local repo map. */
  ground: boolean;
  recordSeconds: number;
}
