import { readFile } from 'node:fs/promises';

import { GoogleGenAI } from '@google/genai';

import { parseMarkdownSections, sectionsToMarkdown, type SaymdSections } from './markdown.js';

const ENRICH = process.env.GEMINI_ENRICH_MODEL ?? 'gemini-3.5-flash-lite';

async function generateJson(client: GoogleGenAI, prompt: string): Promise<string> {
  const r = await client.models.generateContent({
    model: ENRICH,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  });
  const t = r.text?.trim();
  if (!t) throw new Error('Empty response from Gemini.');
  return t;
}

export async function mergeContinue(opts: {
  apiKey: string;
  targetPath: string;
  dryRun: boolean;
  cwd: string;
  newMarkdown?: string;
  newSections?: SaymdSections;
}): Promise<string> {
  const existing = await readFile(opts.targetPath, 'utf8').catch(() => '');
  const client = new GoogleGenAI({ apiKey: opts.apiKey });

  const prompt = `You merge an existing agent prompt spec with NEW spoken additions.

Rules:
- Keep valid existing content
- Drop repetitions
- Never silently delete unrelated sections
- Put unresolved contradictions in openQuestions (do not pick a side)
- Return JSON: { "sections": { objective, context, instructions[], constraints[], acceptanceCriteria[], openQuestions[] } }

Existing markdown:
"""
${existing}
"""

New addition:
"""
${opts.newMarkdown ?? JSON.stringify(opts.newSections, null, 2)}
"""

Merged sections JSON only.`;

  const raw = await generateJson(client, prompt);
  const parsed = JSON.parse(raw) as { sections: SaymdSections };
  return sectionsToMarkdown(parsed.sections);
}

export async function reviewSpec(opts: {
  apiKey: string;
  targetPath: string;
  cwd: string;
}): Promise<void> {
  const existing = await readFile(opts.targetPath, 'utf8').catch(() => '');
  const client = new GoogleGenAI({ apiKey: opts.apiKey });

  const prompt = `Review this agent prompt spec. No fake percentage scores.

Return JSON:
{
  "presentSections": ["objective", ...],
  "gaps": ["what is missing or weak"],
  "suggestedContinue": "one sentence on what to speak next for --continue"
}

Spec:
"""
${existing}
"""`;

  const raw = await generateJson(client, prompt);
  const review = JSON.parse(raw) as {
    presentSections: string[];
    gaps: string[];
    suggestedContinue: string;
  };

  console.log('Present sections:', review.presentSections.join(', ') || '(none)');
  if (review.gaps.length) {
    console.log('\nGaps:');
    for (const g of review.gaps) console.log(`  - ${g}`);
  } else {
    console.log('\nNo major gaps detected.');
  }
  console.log(`\nSuggested next step: ${review.suggestedContinue}`);
  console.log('\nRun: saymd --continue to fill gaps.');
}
