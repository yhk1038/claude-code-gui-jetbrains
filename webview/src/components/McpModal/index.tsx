import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, PlusIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Portal } from '@/components/Portal';
import { McpServer, McpRegistryServer } from '@/shared';
import { ParsedMcpServer } from '@/utils/parseMcpJson';
import { useMcpServers } from '@/hooks/useMcpServers';
import { registryServerToPrefill } from '@/hooks/useMcpRegistry';
import { McpServerList } from './McpServerList';
import { McpServerDetail } from './McpServerDetail';
import { McpAddForm } from './McpAddForm';
import { McpMarketplace } from './McpMarketplace';

interface Props {
  onClose: () => void;
}

type View =
  | { kind: 'list' }
  | { kind: 'detail'; name: string }
  | { kind: 'add'; prefill?: { name: string; json: string } }
  | { kind: 'marketplace' };

export function McpModal(props: Props) {
  const { onClose } = props;
  const { servers, configPath, loading, refreshing, error, fetch, reconnect, setEnabled, addServer, removeServer, authenticate, clearAuth } = useMcpServers();

  const [view, setView] = useState<View>({ kind: 'list' });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap for the lifetime of the modal. The chat input underneath runs
  // auto-focus timers (window focus, visibility change, …) that pull focus to
  // its textarea whenever activeElement falls back to document.body — which
  // happens the moment a non-focusable area inside this modal is clicked.
  // Without a trap, clicking a result card or empty space yanks focus to the
  // background composer. Mirrors ConfirmDialog: remember the opener, pull focus
  // back if it escapes while open, and restore it on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleFocusIn = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && e.target instanceof Node && !dialog.contains(e.target)) {
        dialog.focus();
      }
    };
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (view.kind !== 'list') {
          setView({ kind: 'list' });
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, view]);

  function handleSelect(nameOrSpecial: string): void {
    if (nameOrSpecial === '__add__') {
      setView({ kind: 'add' });
    } else {
      setView({ kind: 'detail', name: nameOrSpecial });
    }
  }

  function getSelectedServer(): McpServer | null {
    if (view.kind !== 'detail') return null;
    return servers.find((s) => s.name === view.name) ?? null;
  }

  async function handleReconnect(name: string): Promise<void> {
    await reconnect(name);
    await fetch();
  }

  async function handleToggle(name: string, enabled: boolean): Promise<void> {
    await setEnabled(name, enabled);
    await fetch();
  }

  async function handleRemove(name: string, scope: string): Promise<void> {
    await removeServer(name, scope);
    setView({ kind: 'list' });
    await fetch();
  }

  async function handleAdd(serversToAdd: ParsedMcpServer[], scope: string): Promise<void> {
    const failures: string[] = [];
    for (const s of serversToAdd) {
      try {
        await addServer(s.name, s.config, scope);
      } catch (err) {
        failures.push(`${s.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await fetch();
    if (failures.length > 0) {
      // Some (or all) failed — keep the form open so the user can fix and retry.
      // Servers that succeeded are already reflected by the refetch above.
      throw new Error(
        `${failures.length}/${serversToAdd.length} server(s) failed to add:\n${failures.join('\n')}`,
      );
    }
    setView({ kind: 'list' });
  }

  function handlePick(server: McpRegistryServer): void {
    // Marketplace → Add form: pre-fill name + config JSON, let the user fill any
    // required env/secret values, then add via the same `claude mcp add-json` path.
    setView({ kind: 'add', prefill: registryServerToPrefill(server) });
  }

  const selectedServer = getSelectedServer();
  const ownHeaderView = view.kind === 'add' || view.kind === 'marketplace';

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div ref={dialogRef}
             tabIndex={-1}
             className="w-full max-w-lg bg-surface-raised border border-border-default rounded-xl shadow-2xl overflow-hidden flex flex-col focus:outline-none"
             style={{ maxHeight: '50rem', minHeight: '32rem' }}>
          {/* Header */}
          {!ownHeaderView && (
            <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
              <h2 className="text-lg font-semibold text-text-primary">MCP servers</h2>

              <div className="flex items-center gap-1">
                {view.kind === 'list' && (
                  <button
                    onClick={() => void fetch()}
                    disabled={refreshing}
                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:bg-gray-500/50 transition-colors disabled:hover:bg-transparent"
                    title="Refresh MCP servers"
                  >
                    <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                )}
                {view.kind === 'list' && (
                  <button
                    onClick={() => setView({ kind: 'marketplace' })}
                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:bg-gray-500/50 transition-colors"
                    title="Browse MCP registry"
                  >
                    <MagnifyingGlassIcon className="w-5 h-5" />
                  </button>
                )}
                {view.kind === 'list' && (
                  <button
                    onClick={() => setView({ kind: 'add' })}
                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:bg-gray-500/50 transition-colors"
                    title="Add MCP server"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                )}
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:bg-gray-500/50 transition-colors"
                  >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* loading/error reflect the configured-servers list — not the
                marketplace or add form, which manage their own state. */}
            {!ownHeaderView && loading && (
              <div className="flex-1 flex items-center justify-center text-md text-text-tertiary">
                Checking MCP server health…
              </div>
            )}
            {!ownHeaderView && !loading && error && (
              <div className="flex-1 flex items-center justify-center px-4">
                <p className="text-sm text-state-error-fg text-center">{error}</p>
              </div>
            )}
            {!loading && !error && view.kind === 'list' && (
              <McpServerList servers={servers} configPath={configPath} onSelect={handleSelect} />
            )}
            {!loading && !error && view.kind === 'detail' && selectedServer && (
              <McpServerDetail
                server={selectedServer}
                onBack={() => setView({ kind: 'list' })}
                onReconnect={handleReconnect}
                onAuthenticate={authenticate}
                onClearAuth={clearAuth}
                onToggleEnabled={handleToggle}
                onRemove={handleRemove}
              />
            )}
            {!loading && !error && view.kind === 'detail' && !selectedServer && (
              <div className="flex-1 flex items-center justify-center text-md text-text-tertiary">
                Server not found.
              </div>
            )}
            {view.kind === 'marketplace' && (
              <McpMarketplace onPick={handlePick} onBack={() => setView({ kind: 'list' })} />
            )}
            {view.kind === 'add' && (
              <McpAddForm
                key={view.prefill?.json ?? 'blank'}
                initialName={view.prefill?.name}
                initialJson={view.prefill?.json}
                onAdd={handleAdd}
                onCancel={() => setView({ kind: 'list' })}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-5 border-t border-border-default">
            <a
              href="https://docs.anthropic.com/en/docs/claude-code/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-text-tertiary hover:text-text-secondary underline underline-offset-2"
            >
              Learn more about MCP
            </a>
          </div>
        </div>
      </div>
    </Portal>
  );
}
