import { McpServerStatus } from '@/shared';

interface Props {
  status: McpServerStatus | string;
}

interface BadgeConfig {
  label: string;
  icon: string;
  pill: string | null;
}

const STATUS_CONFIG: Record<string, BadgeConfig> = {
  [McpServerStatus.CONNECTED]: {
    label: 'Connected',
    icon: '✓',
    pill: 'bg-green-600 text-white',
  },
  [McpServerStatus.FAILED]: {
    label: 'Failed',
    icon: '✕',
    pill: 'bg-red-600 text-white',
  },
  [McpServerStatus.NEEDS_AUTH]: {
    label: 'Needs Auth',
    icon: '!',
    pill: 'bg-yellow-500 text-white',
  },
  [McpServerStatus.PENDING]: {
    label: 'Connecting…',
    icon: '○',
    pill: null,
  },
  [McpServerStatus.DISABLED]: {
    label: 'Disabled',
    icon: '○',
    pill: null,
  },
};

export function McpStatusBadge(props: Props) {
  const { status } = props;
  const cfg: BadgeConfig = STATUS_CONFIG[status] ?? { label: status, icon: '○', pill: null };

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1.5 rounded-md flex-shrink-0 ${cfg.pill || ''}`}>
      <span className="leading-none">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
