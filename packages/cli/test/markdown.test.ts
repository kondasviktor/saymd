import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMarkdownSections, sectionsToMarkdown } from '../src/markdown.js';

test('markdown roundtrip', () => {
  const md = `## Objective

Build auth flow

## Context

Next.js app

## Instructions

- Add login route
`;
  const sections = parseMarkdownSections(md);
  assert.equal(sections.objective, 'Build auth flow');
  assert.ok(sections.instructions?.includes('Add login route'));
  const out = sectionsToMarkdown(sections, 'default');
  assert.match(out, /Build auth flow/);
});

test('acceptance criteria does not double checkboxes', () => {
  const out = sectionsToMarkdown(
    {
      objective: 'Ship it',
      acceptanceCriteria: ['- [ ] Users can log in', '[ ] Rate limit public APIs'],
    },
    'feature'
  );
  assert.match(out, /- \[ \] Users can log in/);
  assert.match(out, /- \[ \] Rate limit public APIs/);
  assert.doesNotMatch(out, /- \[ \] - \[ \]/);
});

test('verifyLicense rejects expired', async () => {
  let pro: typeof import('@saymd/pro') | null = null;
  try {
    pro = await import('@saymd/pro');
  } catch {
    // @saymd/pro lives in private saymd-pro — skip when not linked
    return;
  }
  assert.equal(
    pro.verifyLicense({
      email: 'a@b.c',
      plan: 'annual',
      validUntil: '2020-01-01T00:00:00Z',
      key: 'x',
      signature: 'y',
    }),
    false
  );
});
