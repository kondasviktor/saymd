export interface SaymdSections {
  objective?: string;
  context?: string;
  instructions?: string[];
  constraints?: string[];
  acceptanceCriteria?: string[];
  openQuestions?: string[];
  stepsToReproduce?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
}

export function sectionsToMarkdown(sections: SaymdSections): string {
  const lines: string[] = [];
  if (sections.objective?.trim()) lines.push('## Objective', '', sections.objective.trim(), '');
  if (sections.context?.trim()) lines.push('## Context', '', sections.context.trim(), '');
  if (sections.instructions?.length) {
    lines.push('## Instructions', '');
    for (const item of sections.instructions) lines.push(`- ${item}`);
    lines.push('');
  }
  if (sections.constraints?.length) {
    lines.push('## Constraints', '');
    for (const c of sections.constraints) lines.push(`- ${c}`);
    lines.push('');
  }
  if (sections.acceptanceCriteria?.length) {
    lines.push('## Acceptance criteria', '');
    for (const c of sections.acceptanceCriteria) lines.push(`- [ ] ${c}`);
    lines.push('');
  }
  if (sections.openQuestions?.length) {
    lines.push('## Open questions', '');
    for (const q of sections.openQuestions) lines.push(`- ${q}`);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

export function parseMarkdownSections(markdown: string): SaymdSections {
  const sections: SaymdSections = {};
  const headingRe = /^## (.+)$/gm;
  const matches = [...markdown.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim().toLowerCase();
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? markdown.length) : markdown.length;
    const body = markdown.slice(start, end).trim();
    if (!body) continue;
    if (title === 'objective') sections.objective = body;
    else if (title === 'context') sections.context = body;
    else if (title === 'instructions' || title === 'steps') {
      sections.instructions = body
        .split('\n')
        .map((l) => l.replace(/^[-*\d.]+\s*/, '').trim())
        .filter(Boolean);
    } else if (title === 'constraints') {
      sections.constraints = body.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
    } else if (title === 'acceptance criteria') {
      sections.acceptanceCriteria = body.split('\n').map((l) => l.replace(/^[-*[\] ]+/, '').trim()).filter(Boolean);
    } else if (title === 'open questions') {
      sections.openQuestions = body.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
    }
  }
  return sections;
}
