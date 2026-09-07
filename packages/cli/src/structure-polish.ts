import type { SaymdSections, TemplateId } from './types.js';
import { normalizeKnownAsr } from './asr-normalize.js';

function mapStrings(sections: SaymdSections, fn: (s: string) => string): SaymdSections {
  const out: SaymdSections = { ...sections };
  for (const key of Object.keys(out) as (keyof SaymdSections)[]) {
    const val = out[key];
    if (typeof val === 'string') out[key] = fn(val) as never;
    else if (Array.isArray(val)) out[key] = val.map(fn) as never;
  }
  return out;
}

/** Pull context from common dictation patterns when the model left it empty. */
export function recoverContextFromTranscript(raw: string, sections: SaymdSections): SaymdSections {
  if (sections.context?.trim()) return sections;
  const patterns = [
    /\bContext\s*[.:]\s*(.+?)(?:\.\s+(?:Step|Steps|Constraint|Open question)|$)/i,
    /\bContext\s+(.+?)(?:\.\s+(?:Step|Steps|Constraint|Open question)|$)/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m?.[1]?.trim()) {
      return { ...sections, context: m[1].trim().replace(/\.$/, '') };
    }
  }
  return sections;
}

/**
 * Deterministic polish after the LLM — ASR product-name fixes and missing Context recovery.
 */
export function polishStructuredSections(
  raw: string,
  sections: SaymdSections,
  _template: TemplateId
): SaymdSections {
  let next = mapStrings(sections, normalizeKnownAsr);
  next = recoverContextFromTranscript(normalizeKnownAsr(raw), next);
  return mapStrings(next, normalizeKnownAsr);
}
