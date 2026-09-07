import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeKnownAsr } from '../src/asr-normalize.js';
import { parseMarkdownSections, sectionsToMarkdown } from '../src/markdown.js';

test('normalizeKnownAsr fixes Saint and SanePro mishearings of saymd', () => {
  assert.equal(
    normalizeKnownAsr('Implementation plan for Saint Pro checkout on Saint app'),
    'Implementation plan for saymd Pro checkout on saymd.app'
  );
  assert.equal(normalizeKnownAsr('Use Saint MD CLI'), 'Use saymd CLI');
  assert.equal(
    normalizeKnownAsr('Implementation plan for SanePro checkout on SaneApp'),
    'Implementation plan for saymd Pro checkout on saymd.app'
  );
});

test('polish recovers plan Context and saymd spelling', async () => {
  const { polishStructuredSections } = await import('../src/structure-polish.js');
  const polished = polishStructuredSections(
    'Implementation plan for Saint Pro checkout. Context: Private landing and Stripe on Saint app. Step one: prices.',
    {
      objective: 'Implementation plan for Saint Pro checkout',
      instructions: ['Create prices'],
    },
    'plan'
  );
  assert.match(polished.objective ?? '', /saymd Pro/);
  assert.match(polished.context ?? '', /saymd\.app/);
  assert.match(polished.context ?? '', /Private landing/);
});

test('resolveUserPath keeps absolute outputs outside cwd', async () => {
  const { resolveUserPath } = await import('../src/paths.js');
  const abs = '/Users/kondasviktor/Documents/saymd-test/.ai/03-plan.md';
  assert.equal(resolveUserPath('/Users/kondasviktor/Documents/gemini-transcribe/saymd', abs), abs);
  assert.equal(
    resolveUserPath('/Users/kondasviktor/Documents/gemini-transcribe/saymd', '.ai/out.md'),
    '/Users/kondasviktor/Documents/gemini-transcribe/saymd/.ai/out.md'
  );
});

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
