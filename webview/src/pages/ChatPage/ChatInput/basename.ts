/**
 * Cross-platform basename for absolute paths arriving from Kotlin (IDE drop / file
 * chooser) or from the browser. Strips trailing separators and returns the last
 * path segment, falling back to the original string when no separator is present.
 */
export function basename(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;
}
