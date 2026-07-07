import { useMemo } from 'react';
import { McpServer, McpServerScope, McpServerStatus } from '@/shared';
import { useTranslation } from '@/i18n';
import { McpStatusBadge } from './McpStatusBadge';

interface Props {
  servers: McpServer[];
  /** Global config path (~/.claude.json or $CLAUDE_CONFIG_DIR/.claude.json) backing user/local scopes. */
  configPath?: string;
  onSelect: (name: string) => void;
}

const SCOPE_ORDER: string[] = ['project', 'local', 'user', 'claudeai', 'managed', 'enterprise'];

/**
 * Source location shown at the right of each scope group header, matching where
 * `claude mcp add -s <scope>` actually writes. `configPath` is the real global
 * config path resolved by the backend (~/.claude.json, or
 * `$CLAUDE_CONFIG_DIR/.claude.json` when that env var is set), so the displayed
 * path follows CLAUDE_CONFIG_DIR. claude.ai / managed / enterprise have no local
 * config file, so they return null and are left blank.
 */
function scopeSource(scope: string, configPath: string): { short: string; full: string } | null {
  switch (scope) {
    case McpServerScope.USER:
      return {
        short: `$.mcpServers in ${configPath}`,
        full: `$.mcpServers in ${configPath} — all your projects`,
      };
    case McpServerScope.LOCAL:
      return {
        short: `$.projects[<cwd>].mcpServers in ${configPath}`,
        full: `$.projects[<cwd>].mcpServers in ${configPath} — this project only, private to you`,
      };
    case McpServerScope.PROJECT:
      return {
        short: `<project>/.mcp.json`,
        full: `<project>/.mcp.json — shared with the team (committed to git)`,
      };
    default:
      return null;
  }
}

export function McpServerList(props: Props) {
  const { t } = useTranslation('common');
  const { servers, configPath = '~/.claude.json', onSelect } = props;

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
      .map((k) => ({ scope: k, servers: map.get(k)! }));
  }, [servers]);

  if (servers.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-text-tertiary">
        {t('mcpModal.list.noServersConfigured')}{' '}
        <button
          className="text-accent-primary underline underline-offset-2 hover:no-underline"
          onClick={() => onSelect('__add__')}
        >
          {t('mcpModal.list.addOne')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {groups.map(({ scope, servers: group }) => {
        const src = scopeSource(scope, configPath);
        return (
        <div key={scope} className="mb-3">
          <div className="flex items-baseline justify-between gap-2 py-1.5">
            <span className="text-sm font-semibold text-gray-400 flex-shrink-0">
              {t(`mcpModal.list.scope.${scope}`, { defaultValue: scope })} ({group.length})
            </span>
            {src && (
              <span
                className="text-xs text-text-tertiary font-mono truncate"
                title={src.full}
              >
                {src.short}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {group.map((server) => (
              <button
                key={server.name}
                className={`w-full flex items-center justify-between p-3.5 text-start bg-surface-base border border-border-default rounded-lg hover:bg-surface-hover transition-colors ${server.status === McpServerStatus.DISABLED ? 'opacity-45' : ''}`}
                onClick={() => onSelect(server.name)}
              >
                <span className="text-sm text-text-primary font-mono truncate me-3">{server.name}</span>
                <McpStatusBadge status={server.status} />
              </button>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}
