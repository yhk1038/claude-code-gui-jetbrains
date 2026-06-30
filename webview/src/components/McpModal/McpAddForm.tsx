import { useState } from 'react';
import { McpTransportType } from '@/shared';

interface Props {
  onAdd: (name: string, config: Record<string, unknown>, scope: string) => Promise<void>;
  onCancel: () => void;
}

type TransportTab = 'stdio' | 'http' | 'sse';

export function McpAddForm(props: Props) {
  const { onAdd, onCancel } = props;
  const [name, setName] = useState('');
  const [scope, setScope] = useState('user');
  const [transport, setTransport] = useState<TransportTab>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setError(null);
    setBusy(true);
    try {
      const config = buildConfig();
      await onAdd(name.trim(), config, scope);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function buildConfig(): Record<string, unknown> {
    if (transport === 'stdio') {
      const argList = args.trim() ? args.trim().split(/\s+/) : [];
      return {
        type: McpTransportType.STDIO,
        command: command.trim(),
        args: argList.length ? argList : undefined,
      };
    }
    return {
      type: transport === 'http' ? McpTransportType.HTTP : McpTransportType.SSE,
      url: url.trim(),
    };
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 flex-shrink-0 space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">Add MCP Server</h3>

        {error && (
          <p className="text-xs text-state-error-fg">{error}</p>
        )}

        {/* Name */}
        <Field label="Name">
          <input
            className="w-full text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-server"
            autoFocus
          />
        </Field>

        {/* Scope */}
        <Field label="Scope">
          <select
            className="w-full text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent-primary"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="user">User (all projects)</option>
            <option value="project">Project (.mcp.json)</option>
            <option value="local">Local (this project only)</option>
          </select>
        </Field>

        {/* Transport tabs */}
        <div>
          <label className="block text-sm text-text-tertiary mb-1">Transport</label>
          <div className="flex gap-2">
            {(['stdio', 'http', 'sse'] as TransportTab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`text-md px-3 py-1 rounded transition-colors ${
                  transport === t
                    ? 'bg-accent-primary text-white'
                    : 'bg-surface-hover text-text-secondary hover:bg-surface-raised'
                }`}
                onClick={() => setTransport(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Transport-specific fields */}
        {transport === 'stdio' ? (
          <>
            <Field label="Command">
              <input
                className="w-full text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx"
              />
            </Field>
            <Field label="Arguments (space-separated)">
              <input
                className="w-full text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary font-mono focus:outline-none focus:border-accent-primary"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="-y my-mcp-server"
              />
            </Field>
          </>
        ) : (
          <Field label="URL">
            <input
              className="w-full text-sm bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary font-mono focus:outline-none focus:border-accent-primary"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000/mcp"
            />
          </Field>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-md py-2 rounded bg-surface-hover text-text-secondary hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 text-md py-2 rounded bg-accent-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add server'}
        </button>
      </div>
    </form>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-text-tertiary mb-1.5">{props.label}</label>
      {props.children}
    </div>
  );
}
