import React from 'react';
import { TreeGroup, TreeItem } from './treeModel';

interface Props {
  title: string;
  subtitle: string;
  groups: TreeGroup[];
}

/** A single tree leaf: connector glyph + name + muted token label. */
const TreeLeaf: React.FC<{ item: TreeItem; last: boolean }> = ({ item, last }) => (
  <div className="flex items-baseline gap-1.5 font-ide-code text-[0.75rem] leading-relaxed">
    <span className="shrink-0 select-none text-text-tertiary">{last ? '└─' : '├─'}</span>
    <span className="min-w-0 truncate text-text-secondary" title={item.title ?? item.name}>
      {item.name}
    </span>
    <span className="shrink-0 text-text-tertiary">: {item.tokensLabel} tokens</span>
  </div>
);

/**
 * A collapsible-free detail section rendered as a tree, mirroring the native TUI
 * (Custom Agents / Memory Files / Skills). A "Title · subtitle" header, optional
 * per-group headers (e.g. the Source bucket), then the leaves — each drawn with
 * box-drawing connectors (└ for the last item) so the list reads as a terminal
 * tree rather than a table.
 */
export const ContextTreeSection: React.FC<Props> = (props: Props) => {
  if (props.groups.length === 0) return null;

  return (
    <section className="px-4 py-2">
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <h4 className="text-[0.8125rem] font-medium text-text-primary">{props.title}</h4>
        <span className="font-ide-code text-xs text-text-tertiary">· {props.subtitle}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {props.groups.map((group, groupIndex) => (
          <div key={group.label ?? `group-${groupIndex}`} className="flex flex-col">
            {group.label && (
              <div className="mb-0.5 font-ide-code text-[0.75rem] font-medium text-text-tertiary">
                {group.label}
              </div>
            )}
            <div className="flex flex-col border-l border-border-subtle/60 pl-2">
              {group.items.map((item, itemIndex) => (
                <TreeLeaf
                  key={`${item.name}-${itemIndex}`}
                  item={item}
                  last={itemIndex === group.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
