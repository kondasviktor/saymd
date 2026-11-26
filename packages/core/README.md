# @saymd/core

The saymd pipeline, shared by the [saymd CLI](https://www.npmjs.com/package/saymd) and Pro Cloud, so both produce the same specs.

- Speech-to-text providers: Groq, Gemini, OpenAI, Deepgram, ElevenLabs
- Transcript structuring into a spec (Objective, Context, Instructions, Constraints, Acceptance criteria)
- Spec Markdown

No config files, no ffmpeg, no Pro features: callers pass API keys and audio (a file path or bytes).

```ts
import { transcribeAudio, compileSpec } from '@saymd/core';

const t = await transcribeAudio({
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY!,
  audio: { data: voiceNoteBytes, filename: 'note.ogg', mimeType: 'audio/ogg' },
});
const spec = await compileSpec({ sttProvider: 'gemini', keys: { gemini: process.env.GEMINI_API_KEY }, raw: t.raw, template: 'feature' });
console.log(spec.markdown);
```

MIT.
