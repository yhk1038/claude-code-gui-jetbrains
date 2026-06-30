import { useMemo } from 'react';
import { McpServer, McpServerScope, McpServerStatus } from '@/shared';
import { McpStatusBadge } from './McpStatusBadge';

interface Props {
  servers: McpServer[];
  onSelect: (name: string) => void;
}

const SCOPE_LABEL: Record<string, string> = {
  [McpServerScope.PROJECT]: 'Project',
  [McpServerScope.LOCAL]: 'Local',
  [McpServerScope.USER]: 'User',
  [McpServerScope.CLAUDEAI]: 'claude.ai',
  [McpServerScope.MANAGED]: 'Managed',
  [McpServerScope.ENTERPRISE]: 'Enterprise',
};

const SCOPE_ORDER: string[] = ['project', 'local', 'user', 'claudeai', 'managed', 'enterprise'];

export function McpServerList(props: Props) {
  const { servers, onSelect } = props;

  const groups = useMemo(() => {
    const map = new Map<string, McpServer[]>();
    for (const s of servers) {
      const key = s.scope as string;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return SCOPE_ORDER
      .filter((k) => map.has(k))
      .concat([...map.keys()].filter((k) => !SCOPE_ORDER.includes(k)))
      .map((k) => ({ scope: k, label: SCOPE_LABEL[k] ?? k, servers: map.get(k)! }));
  }, [servers]);

  if (servers.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-text-tertiary">
        No MCP servers configured.{' '}
        <button
          className="text-accent-primary underline underline-offset-2 hover:no-underline"
          onClick={() => onSelect('__add__')}
        >
          Add one
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {groups.map(({ scope, label, servers: group }) => (
        <div key={scope} className="mb-3">
          <div className="py-1.5 text-sm font-semibold text-gray-400">
            {label} ({group.length})
          </div>
          <div className="flex flex-col gap-2">
            {group.map((server) => (
              <button
                key={server.name}
                className={`w-full flex items-center justify-between p-3.5 text-left bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors ${server.status === McpServerStatus.DISABLED ? 'opacity-45' : ''}`}
                onClick={() => onSelect(server.name)}
              >
                <span className="text-sm text-text-primary font-mono truncate mr-3">{server.name}</span>
                <McpStatusBadge status={server.status} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
