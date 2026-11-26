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
  'saymd-split',
  'saymd-inbox',
];
for (const c of cmds) {
  const p = path.join(ROOT, 'commands', `${c}.md`);
  if (!fs.existsSync(p)) fail(`missing commands/${c}.md`);
  else ok(`commands/${c}.md`);
}

const rootPlugin = readJson('plugin.json');
if (rootPlugin && rootPlugin.name !== 'saymd') fail('plugin.json name must be saymd');
else if (rootPlugin) ok('plugin.json name=saymd (Antigravity CLI plugin)');

// Gemini CLI is retired; Antigravity CLI uses plugin.json + skills/ (+ mcp_config.json, rules/).
for (const legacy of ['gemini-extension.json', 'GEMINI.md']) {
  if (fs.existsSync(path.join(ROOT, legacy))) fail(`${legacy} is Gemini CLI only (retired) — remove it`);
}
ok('no Gemini CLI files (gemini-extension.json, GEMINI.md)');
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
// One version for every install line in the plugins, READMEs and the HF wrapper: bump it here at release.
const PINNED_VERSION = '1.0.0';
const PINNED = `npx saymd@${PINNED_VERSION}`;
const scanRoots = ['skills', 'commands', '.claude-plugin', '.codex-plugin', '.cursor-plugin', '.grok-plugin', 'plugin.json', 'README.md', 'packages/cli/README.md', 'wrappers'];
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
  if (!/\.(md|json|sh|js|ts|yml|yaml|html)$/.test(rel)) return;
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

// Every manifest carries the same version as the pin.
for (const f of ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.cursor-plugin/plugin.json', '.grok-plugin/plugin.json']) {
  const j = readJson(f);
  if (j && j.version !== PINNED_VERSION) fail(`${f}: version ${j.version}, expected ${PINNED_VERSION}`);
}
for (const f of ['.claude-plugin/marketplace.json', '.grok-plugin/marketplace.json']) {
  const j = readJson(f);
  if (j && (j.metadata?.version !== PINNED_VERSION || j.plugins?.some((p) => p.version !== PINNED_VERSION))) fail(`${f}: versions must be ${PINNED_VERSION}`);
}
ok(`manifest versions = ${PINNED_VERSION}`);

// MCP Registry: server.json follows the pinned version and matches the npm package's mcpName.
const serverJson = readJson('server.json');
const cliPkg = readJson('packages/cli/package.json');
if (serverJson && cliPkg) {
  if (serverJson.name !== cliPkg.mcpName) fail(`server.json name ${serverJson.name} must equal packages/cli mcpName ${cliPkg.mcpName}`);
  if (serverJson.version !== PINNED_VERSION || serverJson.packages?.[0]?.version !== PINNED_VERSION) fail(`server.json versions must be ${PINNED_VERSION}`);
  if ((serverJson.description || '').length > 100) fail('server.json description over 100 characters (registry limit)');
  ok('server.json matches mcpName and the pinned version');
}

// The retired v1 tagline must not come back into listings.
const v1 = [];
for (const f of ['plugin.json', '.claude-plugin/marketplace.json', '.grok-plugin/marketplace.json', 'skills/saymd/SKILL.md', 'README.md', 'packages/cli/README.md', 'wrappers/huggingface/index.html', 'wrappers/huggingface/README.md']) {
  if (fs.existsSync(path.join(ROOT, f)) && fs.readFileSync(path.join(ROOT, f), 'utf8').includes('Speak once. Get a prompt file')) v1.push(f);
}
if (v1.length) v1.forEach((f) => fail(`${f}: v1 tagline; use the v2 one-liner`));
else ok('v2 one-liner in listings');

process.exit(failed ? 1 : 0);
