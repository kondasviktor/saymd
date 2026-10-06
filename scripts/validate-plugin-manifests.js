#!/usr/bin/env node
/**
 * Lightweight Phase 5 manifest checks (no vendor CLIs required).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failed = 0;

function ok(msg) {
  console.log('✓', msg);
}
function fail(msg) {
  console.error('✗', msg);
  failed += 1;
}

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    fail(`missing ${rel}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`${rel}: ${e.message}`);
    return null;
  }
}

function assertNoDotDot(obj, label) {
  const s = JSON.stringify(obj);
  if (s.includes('..')) fail(`${label}: contains '..' path`);
  else ok(`${label}: no '..' paths`);
}

const files = [
  'plugin.json',
  'gemini-extension.json',
  '.cursor-plugin/plugin.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json',
];

for (const f of files) {
  const j = readJson(f);
  if (j) {
    ok(`${f} parses`);
    assertNoDotDot(j, f);
  }
}

const skill = path.join(ROOT, 'skills/saymd/SKILL.md');
if (!fs.existsSync(skill)) fail('missing skills/saymd/SKILL.md');
else {
  const text = fs.readFileSync(skill, 'utf8');
  if (!text.startsWith('---')) fail('SKILL.md missing YAML frontmatter');
  else if (!/^name:\s*saymd/m.test(text)) fail('SKILL.md missing name: saymd');
  else if (!/^description:/m.test(text)) fail('SKILL.md missing description');
  else ok('SKILL.md frontmatter present');
}

const cmds = [
  'saymd',
  'saymd-feature',
  'saymd-bug',
  'saymd-plan',
  'saymd-continue',
  'saymd-review',
  'saymd-out',
];
for (const c of cmds) {
  const p = path.join(ROOT, 'commands', `${c}.md`);
  if (!fs.existsSync(p)) fail(`missing commands/${c}.md`);
  else ok(`commands/${c}.md`);
}

const rootPlugin = readJson('plugin.json');
if (rootPlugin && rootPlugin.name !== 'saymd') fail('plugin.json name must be saymd');
else if (rootPlugin) ok('plugin.json name=saymd (Antigravity + Agent Plugins)');

if (!fs.existsSync(path.join(ROOT, 'GEMINI.md'))) fail('missing GEMINI.md');
else ok('GEMINI.md (Antigravity still loads this as workspace context)');
if (!fs.existsSync(path.join(ROOT, 'assets/logo.svg'))) fail('missing assets/logo.svg');
else ok('assets/logo.svg');

if (fs.existsSync(path.join(ROOT, 'wrappers/cursor'))) {
  fail('wrappers/cursor should be removed');
}
if (fs.existsSync(path.join(ROOT, 'wrappers/gemini-cli'))) {
  fail('wrappers/gemini-cli should be removed');
}
ok('broken Cursor/Gemini wrappers absent');

// Claude community review rejects unpinned package runners (npx pkg / pkg@latest).
const PINNED = 'npx saymd@0.1.2';
const scanRoots = ['skills', 'commands', 'GEMINI.md', '.claude-plugin', '.codex-plugin', 'plugin.json'];
const unpinned = [];
function scanFile(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(abs)) {
      if (name === 'node_modules') continue;
      scanFile(path.join(rel, name));
    }
    return;
  }
  if (!/\.(md|json|sh|js|ts|yml|yaml)$/.test(rel)) return;
  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/\bnpx\s+saymd(?!@)/.test(line) || /\bsaymd@latest\b/.test(line)) {
      unpinned.push(`${rel}:${i + 1}`);
    } else if (/\bnpx\s+saymd@/.test(line) && !line.includes(PINNED)) {
      unpinned.push(`${rel}:${i + 1}`);
    }
  });
}
for (const r of scanRoots) scanFile(r);
if (unpinned.length) {
  unpinned.forEach((m) => fail(`${m}: use ${PINNED} (exact pin required for Claude review)`));
} else {
  ok(`plugin text pins ${PINNED}`);
}

process.exit(failed ? 1 : 0);
