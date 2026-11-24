declare module '@saymd/pro' {
  export interface SaymdLicenseFile {
    email: string;
    plan: 'annual' | 'monthly';
    validUntil: string;
    key: string;
    signature: string;
  }

  export function verifyLicense(license: SaymdLicenseFile): boolean;
  export function parseLicenseKey(raw: string): SaymdLicenseFile;
  export function detectTemplate(markdown: string): 'default' | 'feature' | 'bug' | 'plan';
  export function mergeContinue(opts: {
    apiKey: string;
    targetPath: string;
    dryRun: boolean;
    cwd: string;
    newMarkdown?: string;
    newSections?: Record<string, unknown>;
    template?: 'default' | 'feature' | 'bug' | 'plan';
  }): Promise<string>;
  export function reviewSpec(opts: {
    apiKey: string;
    targetPath: string;
    cwd: string;
  }): Promise<void>;
  export function getRecordingLimits(): {
    defaultSeconds: number;
    maxMicSeconds: number;
    maxFileSeconds: number;
  };
  export function proCompilerAddendum(opts: { vocab: string[]; outLang?: string }): string;
  export function translateSections(opts: {
    apiKey: string;
    sections: Record<string, unknown>;
    outLang: string;
    template?: 'default' | 'feature' | 'bug' | 'plan';
  }): Promise<Record<string, unknown>>;

  // --- 0.2.0: --ground ---
  export interface RepoMap {
    root: string;
    files: string[];
    truncated: boolean;
    package?: { name?: string; scripts: string[]; dependencies: string[]; devDependencies: string[] };
    schemas: { prisma: string[]; sqlTables: string[]; openapi: string[] };
    agentDocs: Record<string, string[]>;
  }
  export interface PathCheck {
    referenced: string[];
    found: string[];
    newFiles: string[];
    missing: string[];
  }
  export function buildRepoMap(cwd: string, opts?: { maxFiles?: number }): Promise<RepoMap>;
  export function formatRepoMap(map: RepoMap, budgetChars?: number): string;
  export function groundAddendum(mapText: string): string;
  export function checkPaths(
    sections: Record<string, unknown>,
    root: string,
    map?: Partial<Pick<RepoMap, 'package' | 'files'>>
  ): Promise<PathCheck>;
  export function flagPaths<T extends Record<string, unknown>>(sections: T, check: PathCheck, lang?: string): T;

  // --- 0.2.0: --split ---
  export interface DraftTask {
    slug: string;
    title: string;
    depends_on: string[];
    sections: Record<string, unknown>;
  }
  export interface TaskFile {
    id: string;
    title: string;
    depends_on: string[];
    status: 'todo' | 'in_progress' | 'done';
    file: string;
    body: string;
  }
  export function splitTasks(opts: {
    llm: (prompt: string) => Promise<string>;
    raw: string;
    rules?: string;
    maxTasks?: number;
  }): Promise<{ language: string; summary: string; tasks: DraftTask[] }>;
  export function planTaskFiles(
    dir: string,
    drafts: DraftTask[],
    meta?: { created?: string; source?: string; language?: string }
  ): Promise<{ files: Array<{ name: string; content: string; task: TaskFile }>; existing: TaskFile[] }>;
  export function writeTaskFiles(
    dir: string,
    drafts: DraftTask[],
    meta?: { created?: string; source?: string; language?: string }
  ): Promise<{ dir: string; written: TaskFile[]; all: TaskFile[] }>;
  export const PRO_FEATURES: readonly string[];

  // --- 0.2.0: saymd mcp ---
  export function findRepoRoot(cwd: string): Promise<string>;
  export function listTasks(root: string): Promise<{
    tasks: Array<{ id: string; path: string; title: string; status: string; depends_on: string[]; ready: boolean }>;
    next: string | null;
    counts: { todo: number; in_progress: number; done: number };
  }>;
  export function listInbox(
    root: string,
    opts?: { status?: string }
  ): Promise<Array<{ id: string; path: string; title: string; status: string; created?: string; source: string }>>;
  export function startMcpServer(opts: { cwd: string; root?: string; version?: string }): Promise<void>;
}
