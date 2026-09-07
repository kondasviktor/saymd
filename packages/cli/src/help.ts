import { FREE_MAX_SECONDS, PRO_MAX_MIC_SECONDS, PRO_UPGRADE_URL as PRO_URL } from './pro-gate.js';

const GITHUB = 'https://github.com/kondasviktor/saymd';
const PRIVACY = 'https://saymd.app/privacy.html';

/** Human onboarding — `saymd help` */
export function printStartHere(): void {
  console.log(`saymd — Speak once. Get a prompt file any agent can @.

Start here — Free
─────────────────
1) saymd setup
   Choose a transcription provider (Gemini recommended) and add your API key.
   Clipboard or hidden paste — the key stays on this machine.

2) saymd doctor
   Checks ffmpeg, microphone, provider, and API key.

3) saymd -o .ai/prompt.md --template feature --seconds 30
   Speak naturally, then press Enter when finished.

Output: Objective / Context / Instructions / Constraints
(The raw transcript is not the main artifact — the structured spec is.)

Then open .ai/prompt.md and @ it in Cursor, Claude Code, Codex,
Gemini CLI, Copilot, or any AI agent that can read Markdown.

Languages — Free
────────────────
Auto-detect, 85+ languages.
Markdown is written in the same language you spoke.

  saymd --lang hu          # optional hint if auto-detect is wrong
  saymd --out en           # Pro: speak one language, write the spec in another

Templates — Free
────────────────
Same audio in; different markdown out.

  --template feature    Objective, Context, Instructions, Constraints, Acceptance criteria
  --template bug        Objective, Context, Steps to reproduce, Expected / Actual
  --template plan       Objective, Context, numbered Steps, Constraints, Open questions
  (no --template)       Objective, Context, Instructions, Constraints

  saymd --template bug -o .ai/bug.md
  saymd --file idea.m4a --template feature -o .ai/feature.md

Supported audio: mp3, m4a, wav, ogg, opus, flac, webm, aiff, caf, mp4, mov

Recording
─────────
Press Enter to stop — you do not need to wait for the maximum.
Free: up to ${FREE_MAX_SECONDS} seconds per recording (default ${FREE_MAX_SECONDS}s)
Pro:  default 120 seconds, up to ${PRO_MAX_MIC_SECONDS / 60} minutes per recording
  --seconds 30             shorter first test

Providers — BYOK
────────────────
You pay the speech-to-text provider on your own account.

  Gemini                   recommended
  OpenAI
  Deepgram
  ElevenLabs

  saymd setup              configure or change provider / key
  saymd config             show current provider (never prints the key)
  saymd config set provider openai

Pro — when you need more
────────────────────────
  saymd --continue .ai/prompt.md
      add more speech and merge it into the same spec

  saymd --review .ai/prompt.md
      find missing requirements, constraints, and acceptance criteria

  saymd --out en
      speak one language → write the spec in another

  .saymd/vocab.txt
      project names, APIs, acronyms, terminology (one per line)

  longer recordings
      up to ${PRO_MAX_MIC_SECONDS / 60} minutes per recording

Privacy
───────
API keys stay on this machine (~/.saymd/config.json, mode 0600).
Audio is sent only to the STT provider you chose, using your key.
saymd does not receive your audio, transcripts, or prompt files.
  ${PRIVACY}

Useful commands
───────────────
  saymd --help             full option list
  saymd doctor             check your installation
  saymd setup              configure or change provider / API key
  saymd activate <code>    activate Pro (downloads Pro automatically)

  Pro     ${PRO_URL}
  GitHub  ${GITHUB}
`);
}

/** Conventional flag reference — `saymd --help` */
export function printHelp(): void {
  console.log(`saymd — Speak once. Get a prompt file any agent can @.

Onboarding:  saymd help
Quick start: saymd setup && saymd doctor && saymd -o .ai/prompt.md --template feature --seconds 30

Usage
  saymd [--file audio] [options]
  saymd setup | doctor | help | config
  saymd config set provider <gemini|openai|deepgram|elevenlabs>
  saymd activate <activation-code>   # downloads Pro into ~/.saymd automatically

Free options
  --provider gemini|openai|deepgram|elevenlabs
  --template feature|bug|plan
                        feature: Objective, Context, Instructions, Constraints, Acceptance criteria
                        bug:     Objective, Context, Steps to reproduce, Expected / Actual
                        plan:    Objective, Context, numbered Steps, Constraints, Open questions
  -o, --output path     markdown path (default: .ai/prompt.md)
  --lang CODE           input language hint (auto-detect 85+; same language out)
  --seconds N           max seconds per recording (Enter to stop sooner)
                        Free default/max: ${FREE_MAX_SECONDS}s per recording
                        Pro default: 120s, max ${PRO_MAX_MIC_SECONDS / 60} min per recording
  --file path           mp3, m4a, wav, ogg, opus, flac, webm, aiff, caf, mp4, mov
  --raw | --stdout | --clipboard | --json | --diff | --dry-run

Pro options → ${PRO_URL}
  --continue [file]     merge new speech into an existing spec
  --review [file]       missing requirements, constraints, acceptance criteria
  --out CODE            cross-language output (e.g. speak HU, write EN)

BYOK: keys in ~/.saymd/config.json or env. Never paste keys into chat.
Privacy: ${PRIVACY}
`);
}

export function printNextAfterSetup(providerId: string): void {
  console.log(`
Next
────
  saymd doctor
  saymd -o .ai/prompt.md --template feature --seconds 30

Speak, press Enter, then @ the file in your agent.
Later: saymd --continue .ai/prompt.md  (Pro → ${PRO_URL})

Provider saved: ${providerId}
`);
}
