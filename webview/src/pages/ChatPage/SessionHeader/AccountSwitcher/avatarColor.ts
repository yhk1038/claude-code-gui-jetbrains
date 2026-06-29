export const AVATAR_PALETTE = [
  'bg-rose-400',
  'bg-orange-600',
  'bg-amber-600',
  'bg-teal-500',
  'bg-sky-500',
  'bg-violet-400',
  'bg-pink-400',
  'bg-emerald-600',
] as const;

/**
 * Pick a background color class from AVATAR_PALETTE for any real number.
 * Converts the input to a positive integer, then maps it to a palette index via modulo.
 */
export function avatarColorClass(n: number): string {
  const idx = Math.abs(Math.floor(n)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}
