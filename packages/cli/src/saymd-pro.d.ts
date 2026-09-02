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
}
