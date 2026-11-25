import { readFileSync } from 'node:fs';

/** Installed CLI version, so config snippets pin an exact `saymd@x.y.z` (plugin reviews require it). */
export function cliVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const MCP_CLIENTS = ['claude', 'cursor', 'codex', 'antigravity', 'vscode'] as const;
export type McpClient = (typeof MCP_CLIENTS)[number];

/** Ready-to-paste MCP settings for each agent. The server runs in the agent's project folder. */
export function mcpConfig(client: McpClient, version = cliVersion()): string {
  const args = ['-y', `saymd@${version}`, 'mcp'];
  const server = { command: 'npx', args };
  switch (client) {
    case 'claude':
      return `# Claude Code — run in your repo (writes .mcp.json, shared with the team):
claude mcp add --scope project saymd -- npx ${args.join(' ')}

# or put this in .mcp.json yourself:
${JSON.stringify({ mcpServers: { saymd: server } }, null, 2)}`;
    case 'cursor':
      return `# Cursor — .cursor/mcp.json in your repo:
${JSON.stringify({ mcpServers: { saymd: server } }, null, 2)}`;
    case 'codex':
      return `# Codex — ~/.codex/config.toml (Codex starts it in the folder you run codex from):
[mcp_servers.saymd]
command = "npx"
args = ${JSON.stringify(args)}`;
    case 'antigravity':
      return `# Antigravity CLI / App / IDE — .agents/mcp_config.json in your repo
# (or ~/.gemini/config/mcp_config.json for every project; /mcp in agy shows its status):
${JSON.stringify({ mcpServers: { saymd: server } }, null, 2)}`;
    case 'vscode':
      return `# VS Code / GitHub Copilot — .vscode/mcp.json in your repo:
${JSON.stringify({ servers: { saymd: { type: 'stdio', ...server } } }, null, 2)}`;
  }
}

export function printMcpConfig(client?: string): void {
  if (client && !(MCP_CLIENTS as readonly string[]).includes(client)) {
    console.error(`Unknown client: ${client}. Use one of: ${MCP_CLIENTS.join(', ')}`);
    process.exit(1);
  }
  const clients = client ? [client as McpClient] : [...MCP_CLIENTS];
  console.log(clients.map((c) => mcpConfig(c)).join('\n\n'));
  console.log(`
Tools: list_inbox, get_item, list_tasks, mark_done (Pro). Agents work through .ai/tasks/ in order
and mark each task done. Check it: saymd mcp --check`);
}
