import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { McpRegistryServer } from '@/shared';
import { useMcpRegistry } from '@/hooks/useMcpRegistry';

interface Props {
  onPick: (server: McpRegistryServer) => void;
  onBack: () => void;
}

export function McpMarketplace(props: Props) {
  const { onPick, onBack } = props;
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  // Debounce the search box so each keystroke doesn't hit the registry.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { servers, loading, error } = useMcpRegistry(query);
  const hasQuery = query.trim().length > 0;

  // The registry returns one entry per published version, so the same server
  // (identical reverse-DNS name) shows up multiple times. Collapse to the first
  // occurrence — the result list has no per-version UI, so the duplicates are
  // pure visual noise.
  const uniqueServers = useMemo(() => {
    const seen = new Set<string>();
    return servers.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  }, [servers]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: back + search box */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:bg-gray-500/50 transition-colors flex-shrink-0"
          title="Back"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          <input
            className="w-full text-md bg-surface-hover border border-border-default rounded pl-8 pr-2 py-1.5 text-text-primary focus:outline-none focus:border-accent-primary"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search the MCP registry…"
            autoFocus
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
        {!hasQuery && (
          <p className="px-1 py-8 text-center text-sm text-text-tertiary">
            Search the official MCP registry to find and install servers.
          </p>
        )}
        {hasQuery && loading && (
          <p className="px-1 py-8 text-center text-sm text-text-tertiary">Searching…</p>
        )}
        {hasQuery && !loading && error && (
          <p className="px-1 py-8 text-center text-sm text-state-error-fg">{error}</p>
        )}
        {hasQuery && !loading && !error && uniqueServers.length === 0 && (
          <p className="px-1 py-8 text-center text-sm text-text-tertiary">No servers found.</p>
        )}
        {hasQuery && !loading && !error && uniqueServers.length > 0 && (
          <div className="flex flex-col gap-2">
            {uniqueServers.map((server) => (
              <McpRegistryCard key={server.name} server={server} onPick={onPick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function McpRegistryCard(props: { server: McpRegistryServer; onPick: (s: McpRegistryServer) => void }) {
  const { server, onPick } = props;
  const shortName = server.name.split('/').pop() || server.name;
  const installable = server.config !== null;

  return (
    <div className="flex items-start justify-between gap-3 p-3.5 bg-surface-base border border-border-default rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {server.repositoryUrl ? (
            <a
              href={server.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group/title inline-flex items-center gap-1 min-w-0 text-sm font-semibold text-text-primary hover:text-accent-primary transition-colors"
              title={`Open ${server.repositoryUrl}`}
            >
              <span className="truncate underline-offset-2 group-hover/title:underline">{shortName}</span>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 flex-shrink-0 text-text-tertiary group-hover/title:text-accent-primary" />
            </a>
          ) : (
            <span className="text-sm font-semibold text-text-primary truncate">{shortName}</span>
          )}
          <span className="text-xs text-text-tertiary font-mono truncate">{server.name}</span>
        </div>
        {server.description && (
          <p className="mt-1 text-xs text-text-secondary line-clamp-2">{server.description}</p>
        )}
        {server.requiredInputs.length > 0 && (
          <p className="mt-1 text-xs text-text-tertiary">
            Needs {server.requiredInputs.length} input{server.requiredInputs.length > 1 ? 's' : ''}:{' '}
            {server.requiredInputs.join(', ')}
          </p>
        )}
      </div>
      <button
        disabled={!installable}
        onClick={() => onPick(server)}
        className="flex-shrink-0 text-md px-3 py-1.5 rounded bg-accent-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        title={installable ? 'Configure & add' : 'No install info available'}
      >
        Add
      </button>
    </div>
  );
}
