/** Shared structuring rules for Free (and base for Pro addendum). */
export function freeCompilerRules(): string {
  return `Language rules (mandatory unless a Pro output-language override is present below):
1. Detect the transcript language (see field "language"). Write EVERY section's prose in that language — objective, context, instructions, constraints, acceptance criteria, open questions, steps, expected/actual.
2. Critical anti-pattern: do NOT translate instructions into English when the transcript is Hungarian (or another non-English language). Example for hu: write "Implementáld a Google OAuth bejelentkezést" — not "Implement Google OAuth login".
3. Keep only conventional tech identifiers in English inside that prose: OAuth, Next.js, App Router, REST, PostgreSQL, Stripe, webhook, session cookie, etc.
4. "saymd" is the dictation tool, not the speaker's project. Never name the speaker's app or product unless the transcript names it. Only if the speaker says "saymd" themselves, spell it "saymd" — never Saint / Saint Pro / Saint app.

Structure rules:
5. Always include a non-empty "context" when the transcript mentions context, setting, product, stack, environment, placement, or a named site/app — including plan and bug. If the transcript literally says "Context: …", that sentence belongs in context.
6. Smart cleanup: remove filler and false starts; preserve meaning.
7. Constraints are hard limits only — do not duplicate the same items into both instructions/steps and constraints.
8. Do not invent details the speaker did not say: no made-up APIs, endpoints, file paths, product names, libraries or example values. If something needed is missing, put it in openQuestions instead.`;
}

/** Short reminder placed after the transcript so models do not drop language rules. */
export function freeCompilerReminder(): string {
  return `Reminder before JSON: (a) all prose in the transcript language — especially instructions[]; (b) fill context when the transcript has Context/setting; (c) no product name or detail the speaker did not say; (d) tech identifiers may stay English inside native-language sentences.`;
}
