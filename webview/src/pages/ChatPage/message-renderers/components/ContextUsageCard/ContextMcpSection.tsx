import React, { useMemo, useState } from 'react';
import { ContextMcpEntry } from '@/utils/parseContextUsage';

interface Props {
  title: string;
  subtitle: string;
  tools: ContextMcpEntry[];
}

interface ServerGroup {
  server: string;
  tools: ContextMcpEntry[];
}

/** Group MCP tools by their Server column, preserving first-seen order. */
function groupByServer(tools: ContextMcpEntry[]): ServerGroup[] {
  const order: string[] = [];
  const byServer = new Map<string, ContextMcpEntry[]>();
  for (const tool of tools) {
    const key = tool.server || '—';
    if (!byServer.has(key)) {
      byServer.set(key, []);
      order.push(key);
    }
    byServer.get(key)!.push(tool);
  }
  return order.map((server) => ({ server, tools: byServer.get(server)! }));
}

/** One collapsible server group. Collapsed by default; the header shows the count. */
const McpServerGroup: React.FC<{ group: ServerGroup }> = ({ group }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-left font-ide-code text-[0.75rem] font-medium text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <span
          className={`select-none text-text-tertiary transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ▸
        </span>
        <span className="truncate">{group.server}</span>
        <span className="text-text-tertiary">({group.tools.length})</span>
      </button>

      {open && (
        <div className="ml-2 flex flex-col border-l border-border-subtle/60 pl-2">
          {group.tools.map((tool, index) => (
            <div
              key={`${tool.tool}-${index}`}
              className="flex items-baseline gap-1.5 font-ide-code text-[0.75rem] leading-relaxed"
            >
              <span className="shrink-0 select-none text-text-tertiary">
                {index === group.tools.length - 1 ? '└─' : '├─'}
              </span>
              <span className="min-w-0 truncate text-text-secondary" title={tool.tool}>
                {tool.tool}
              </span>
              <span className="shrink-0 text-text-tertiary">: {tool.tokensLabel} tokens</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The MCP Tools section. Unlike the native TUI's flat print, tools are grouped
 * by their Server and each group is an independent, collapsed-by-default
 * accordion showing the tool count — preserving the Server and token columns
 * while keeping the (often large) tool list tidy.
 */
export const ContextMcpSection: React.FC<Props> = (props: Props) => {
  const groups = useMemo(() => groupByServer(props.tools), [props.tools]);
  if (groups.length === 0) return null;

  return (
    <section className="px-4 py-2">
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <h4 className="text-[0.8125rem] font-medium text-text-primary">{props.title}</h4>
        <span className="font-ide-code text-xs text-text-tertiary">· {props.subtitle}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {groups.map((group) => (
          <McpServerGroup key={group.server} group={group} />
        ))}
      </div>
    </section>
  );
};
