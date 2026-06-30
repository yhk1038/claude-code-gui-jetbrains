import { useState } from 'react';
import { ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { McpServer, McpServerStatus, McpTransportType, canAuthenticate } from '@/shared';
import { McpStatusBadge } from './McpStatusBadge';

interface Props {
  server: McpServer;
  onBack: () => void;
  onReconnect: (name: string) => Promise<void>;
  onAuthenticate: (name: string) => Promise<{ hint?: string }>;
  onClearAuth: (name: string) => Promise<{ hint?: string }>;
  onToggleEnabled: (name: string, enabled: boolean) => Promise<void>;
  onRemove: (name: string, scope: string) => Promise<void>;
}

export function McpServerDetail(props: Props) {
  const { server, onBack, onReconnect, onAuthenticate, onClearAuth, onToggleEnabled, onRemove } = props;
  const [toolsOpen, setToolsOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const busy = busyAction !== null;
  const isClaudeAiProxy = server.config?.type === McpTransportType.CLAUDEAI_PROXY;
  const canAuth = canAuthenticate(server);
  const isConnected = server.status === McpServerStatus.CONNECTED;
  const isDisabled = server.status === McpServerStatus.DISABLED;
  const isFailed = server.status === McpServerStatus.FAILED;
  const needsAuth = server.status === McpServerStatus.NEEDS_AUTH;

  async function wrap(action: string, fn: () => Promise<void>): Promise<void> {
    setBusyAction(action);
    setHint(null);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReconnect(): Promise<void> {
    await wrap('reconnect', () => onReconnect(server.name));
  }

  async function handleAuthenticate(): Promise<void> {
    await wrap('authenticate', async () => {
      const result = await onAuthenticate(server.name);
      if (result.hint) setHint(result.hint);
    });
  }

  async function handleClearAuth(): Promise<void> {
    await wrap('clear-auth', async () => {
      const result = await onClearAuth(server.name);
      if (result.hint) setHint(result.hint);
    });
  }

  async function handleToggle(): Promise<void> {
    await wrap('toggle', () => onToggleEnabled(server.name, isDisabled));
  }

  async function handleRemove(): Promise<void> {
    await wrap('remove', () => onRemove(server.name, server.scope as string));
    onBack();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 pt-4 pb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-md text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeftIcon className="w-6 h-6" />
          <span>Back to list</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {/* Error box — above server name,커서 스타일 */}
        {server.error && (
          <div className="p-3 rounded-lg border border-state-error-fg/40 bg-state-error-bg text-sm text-state-error-fg">
            {server.error}
          </div>
        )}

        {/* Server header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-mono text-base font-semibold text-text-primary leading-none m-0">{server.name}</h3>
          <McpStatusBadge status={server.status} />
        </div>

        {/* Config details */}
        {server.config && (
          <div className="text-sm text-text-tertiary space-y-0.5">
            <div>Type: {server.config.type}</div>
            {server.config.command && (
              <div className="font-mono truncate">
                {server.config.command}
                {server.config.args?.length ? ' ' + server.config.args.join(' ') : ''}
              </div>
            )}
            {server.config.url && (
              <div className="font-mono truncate">{server.config.url}</div>
            )}
          </div>
        )}

        {/* Hint (terminal instruction) */}
        {hint && (
          <div className="text-sm text-text-secondary bg-surface-hover rounded p-2 font-mono">
            {hint}
          </div>
        )}

        {/* Action buttons — 순서: Authenticate(CTA) → Reconnect → Clear auth → Disable */}
        <div className="flex flex-col gap-4">
          {/* Authenticate — CTA primary, 최상단 */}
          {canAuth && (needsAuth || isFailed) && (
            <ActionButton
              label="Authenticate"
              anyBusy={busy}
              activeAction="authenticate"
              busyAction={busyAction}
              onClick={handleAuthenticate}
              variant="primary"
            />
          )}

          {/* Reconnect */}
          {!isDisabled && (
            <ActionButton
              label="Reconnect"
              busyLabel="Reconnecting"
              anyBusy={busy}
              activeAction="reconnect"
              busyAction={busyAction}
              onClick={handleReconnect}
            />
          )}

          {/* Clear authentication */}
          {canAuth && !isClaudeAiProxy && isConnected && (
            <ActionButton
              label="Clear authentication"
              anyBusy={busy}
              activeAction="clear-auth"
              busyAction={busyAction}
              onClick={handleClearAuth}
            />
          )}

          {/* Enable / Disable */}
          <ActionButton
            label={isDisabled ? 'Enable' : 'Disable'}
            anyBusy={busy}
            activeAction="toggle"
            busyAction={busyAction}
            onClick={handleToggle}
            variant={isDisabled ? 'primary' : 'secondary'}
          />
        </div>

        {/* View tools */}
        {server.tools.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setToolsOpen((p) => !p)}
            >
              {toolsOpen ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
              View tools ({server.tools.length})
            </button>
            {toolsOpen && (
              <div className="mt-2 space-y-1">
                {server.tools.map((tool) => (
                  <div key={tool.name} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-text-primary">{tool.name}</span>
                    {tool.annotations?.readOnly && (
                      <span className="px-1 py-0.5 rounded bg-surface-hover text-text-tertiary">read-only</span>
                    )}
                    {tool.annotations?.destructive && (
                      <span className="px-1 py-0.5 rounded bg-state-error-bg text-state-error-fg">destructive</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Remove */}
        <div className="pt-2">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary">Remove "{server.name}"?</p>
              <div className="flex gap-2">
                <button
                  className="flex-1 text-xs py-1.5 rounded bg-state-error-bg text-state-error-fg hover:opacity-80 transition-opacity"
                  onClick={handleRemove}
                  disabled={busy}
                >
                  Remove
                </button>
                <button
                  className="flex-1 text-xs py-1.5 rounded bg-surface-hover text-text-secondary hover:bg-surface-raised transition-colors"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="text-xs text-state-error-fg hover:underline underline-offset-2"
              onClick={() => setConfirmDelete(true)}
            >
              Remove server
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  busyLabel?: string;
  anyBusy: boolean;
  activeAction: string;
  busyAction: string | null;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

function ActionButton(props: ActionButtonProps) {
  const { label, busyLabel, anyBusy, activeAction, busyAction, onClick, variant = 'secondary' } = props;
  const isActive = busyAction === activeAction;
  const base = 'text-md py-2.5 rounded border border-border-default transition-colors';
  const disabledCls = anyBusy && !isActive ? 'opacity-50 pointer-events-none' : '';
  const cls =
    variant === 'primary'
      ? `${base} bg-accent-primary text-white hover:opacity-90 ${disabledCls}`
      : `${base} bg-surface-hover text-text-primary hover:bg-surface-raised ${disabledCls}`;
  return (
    <button className={cls} disabled={anyBusy} onClick={onClick}>
      {isActive ? (busyLabel ?? label) : label}
    </button>
  );
}
