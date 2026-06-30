import { useState } from 'react';
import { parseMcpJson, ParsedMcpServer } from '@/utils/parseMcpJson';

interface Props {
  /** Pre-fill the Name field (used when arriving from the marketplace). */
  initialName?: string;
  /** Pre-fill the JSON box (used when arriving from the marketplace). */
  initialJson?: string;
  onAdd: (servers: ParsedMcpServer[], scope: string) => Promise<void>;
  onCancel: () => void;
}

const PLACEHOLDER = `{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "my-mcp-server"]
    }
  }
}`;

export function McpAddForm(props: Props) {
  const { onAdd, onCancel, initialName, initialJson } = props;
  const [name, setName] = useState(initialName ?? '');
  const [scope, setScope] = useState('user');
  const [json, setJson] = useState(initialJson ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const parsed = parseMcpJson(json, name);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onAdd(parsed.servers, scope);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 flex-shrink-0 space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">Add MCP Server</h3>

        {error && (
          <p className="text-xs text-state-error-fg whitespace-pre-wrap">{error}</p>
        )}

        {/* Name (optional — used only when the pasted JSON has no mcpServers wrapper) */}
        <Field label="Name" hint="Optional — only used when your JSON has no “mcpServers” wrapper">
          <input
            className="w-full text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-server"
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

        {/* JSON config */}
        <Field label="Configuration (JSON)" hint="Paste an mcpServers config or a single server config">
          <textarea
            className="w-full h-44 text-md bg-surface-hover border border-border-default rounded px-2 py-1.5 text-text-primary font-mono resize-y focus:outline-none focus:border-accent-primary"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={PLACEHOLDER}
            autoFocus
            spellCheck={false}
          />
        </Field>
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

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-text-tertiary mb-1.5">{props.label}</label>
      {props.children}
      {props.hint && <p className="mt-1 text-xs text-text-tertiary">{props.hint}</p>}
    </div>
  );
}
