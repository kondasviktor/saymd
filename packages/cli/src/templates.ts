import type { TemplateId } from './types.js';

export function templatePrompt(id: TemplateId): string {
  switch (id) {
    case 'feature':
      return `Structure as a FEATURE spec with: objective, context, instructions (bullets), constraints, acceptanceCriteria (plain sentences, no markdown). Always include a short Context. Keep conventional tech terms in English even when the spec language is not English.`;
    case 'bug':
      return `Structure as a BUG report with: objective (summary), context, stepsToReproduce, expectedBehavior, actualBehavior, constraints.`;
    case 'plan':
      return `Structure as an IMPLEMENTATION PLAN with: objective, context, instructions as ordered steps, constraints, openQuestions. Constraints are hard limits only — do not repeat the same items already listed as steps. Keep conventional tech terms (REST, PostgreSQL, Kanban, etc.) in their usual English form even when the rest of the spec is another language. Add openQuestions only if the speaker left real gaps.`;
    default:
      return `Structure with: objective, context, instructions (bullets), constraints. Add openQuestions only if the speaker left gaps.`;
  }
}

export function structureSchemaHint(template: TemplateId): string {
  return `Return JSON only:
{
  "language": "detected ISO 639-1 code",
  "clean": "smart-cleaned transcript text",
  "sections": {
    "objective": "string",
    "context": "string",
    "instructions": ["string"],
    "constraints": ["string"],
    "acceptanceCriteria": ["string"],
    "openQuestions": ["string"],
    "stepsToReproduce": ["string"],
    "expectedBehavior": "string",
    "actualBehavior": "string"
  }
}
Omit unused keys. List items must be plain text — no leading dashes or "[ ]" checkboxes. ${templatePrompt(template)}`;
}
