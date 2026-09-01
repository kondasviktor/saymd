import type { TemplateId } from './types.js';

export function templatePrompt(id: TemplateId): string {
  switch (id) {
    case 'feature':
      return `Structure as a FEATURE spec with: objective, context, instructions (bullets), constraints, acceptanceCriteria (checkbox items).`;
    case 'bug':
      return `Structure as a BUG report with: objective (summary), context, stepsToReproduce, expectedBehavior, actualBehavior, constraints.`;
    case 'plan':
      return `Structure as an IMPLEMENTATION PLAN with: objective, context, instructions as ordered steps, constraints, openQuestions.`;
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
Omit unused keys. ${templatePrompt(template)}`;
}
