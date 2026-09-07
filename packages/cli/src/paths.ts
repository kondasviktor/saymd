import { isAbsolute, resolve } from 'node:path';

/** Resolve a user path against cwd. Prefer resolve() — path.join() on Node 22+ can keep cwd when given an absolute segment. */
export function resolveUserPath(cwd: string, userPath: string): string {
  if (!userPath) return cwd;
  return isAbsolute(userPath) ? userPath : resolve(cwd, userPath);
}
