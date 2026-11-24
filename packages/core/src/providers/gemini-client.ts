import { GoogleGenAI } from '@google/genai';

/** Gemini structuring / verify model. Gemini 3.1 Flash-Lite is the stable, low-cost text model. */
export const GEMINI_DEFAULT_TEXT_MODEL = 'gemini-3.1-flash-lite';

export function geminiTextModel(): string {
  return process.env.GEMINI_ENRICH_MODEL?.trim() || GEMINI_DEFAULT_TEXT_MODEL;
}

/** Gemini client. GEMINI_BASE_URL points it at a gateway or a local mock (tests). */
export function geminiClient(apiKey: string): GoogleGenAI {
  const baseUrl = process.env.GEMINI_BASE_URL?.trim();
  return new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
}
