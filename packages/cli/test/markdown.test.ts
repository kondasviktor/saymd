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

test('verifyLicense rejects expired', async () => {
  const { verifyLicense } = await import('@saymd/pro');
  assert.equal(
    verifyLicense({
      email: 'a@b.c',
      plan: 'annual',
      validUntil: '2020-01-01T00:00:00Z',
      key: 'x',
      signature: 'y',
    }),
    false
  );
});
