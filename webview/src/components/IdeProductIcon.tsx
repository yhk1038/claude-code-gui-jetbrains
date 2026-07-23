/**
 * A small product badge for the attached JetBrains IDE (e.g. WebStorm), shown
 * next to the fixed "open files with" value.
 *
 * PLACEHOLDER ICONS: these are simple initial-on-color badges, not the official
 * JetBrains product logos (brand assets). To swap in the real logos later,
 * replace each entry's rendering with the product SVG — the product→badge
 * mapping and the `IdeProductIcon` API stay the same.
 */
interface Badge {
  bg: string;
  fg: string;
  initials: string;
}

// Keyed by the product name the backend parses from CCG_CLIENT_INFO.
const BADGES: Record<string, Badge> = {
  'WebStorm': { bg: '#07c3f2', fg: '#000000', initials: 'WS' },
  'IntelliJ IDEA': { bg: '#fe2857', fg: '#ffffff', initials: 'IJ' },
  'PyCharm': { bg: '#21d789', fg: '#000000', initials: 'PY' },
  'GoLand': { bg: '#3d84c6', fg: '#ffffff', initials: 'GO' },
  'PhpStorm': { bg: '#b345f1', fg: '#ffffff', initials: 'PS' },
  'RubyMine': { bg: '#fc2660', fg: '#ffffff', initials: 'RM' },
  'CLion': { bg: '#22d88f', fg: '#000000', initials: 'CL' },
  'Rider': { bg: '#d63aff', fg: '#ffffff', initials: 'RD' },
  'DataGrip': { bg: '#22d88f', fg: '#000000', initials: 'DG' },
  'DataSpell': { bg: '#3bea62', fg: '#000000', initials: 'DS' },
  'RustRover': { bg: '#ff6b47', fg: '#ffffff', initials: 'RR' },
  'Aqua': { bg: '#22d88f', fg: '#000000', initials: 'AQ' },
  'Android Studio': { bg: '#3ddc84', fg: '#000000', initials: 'AS' },
};

const FALLBACK: Badge = { bg: '#000000', fg: '#ffffff', initials: 'JB' };

interface Props {
  product: string;
  size?: number;
}

export function IdeProductIcon(props: Props) {
  const { product, size = 18 } = props;
  const badge = BADGES[product] ?? FALLBACK;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={product || 'JetBrains'}
    >
      <rect width="24" height="24" rx="5" fill={badge.bg} />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="sans-serif"
        fill={badge.fg}
      >
        {badge.initials}
      </text>
    </svg>
  );
}
