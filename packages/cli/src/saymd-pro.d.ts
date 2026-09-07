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
}
