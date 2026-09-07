/**
 * Fix known Gemini/Whisper mishearings of the product name.
 * Free has no vocab file — this keeps checkout/plan fixtures usable.
 */
export function normalizeKnownAsr(text: string): string {
  return text
    .replace(/\bSane\s*Pro\b/gi, 'saymd Pro')
    .replace(/\bSanePro\b/gi, 'saymd Pro')
    .replace(/\bSane\s*App\b/gi, 'saymd.app')
    .replace(/\bSaneApp\b/gi, 'saymd.app')
    .replace(/\bSaint\s*M[\s.-]*D\b/gi, 'saymd')
    .replace(/\bSaint\s*MD\b/gi, 'saymd')
    .replace(/\bSaint\s*Pro\b/gi, 'saymd Pro')
    .replace(/\bon Saint(?:'s)? app\b/gi, 'on saymd.app')
    .replace(/\bSaint\.app\b/gi, 'saymd.app')
    .replace(/\bSaint app\b/gi, 'saymd.app')
    .replace(/\bsay\s*M\s*D\b/gi, 'saymd')
    .replace(/\bE-?prouter\b/gi, 'App Router')
    .replace(/\bA\s+router\b/gi, 'App Router');
}
