import React from 'react';
import { Context, ContextType } from '../../../../types';
import { getAdapter } from '../../../../adapters';
import { Tooltip } from '../../../../components/Tooltip';

interface ContextPillsProps {
  context: Context[];
}

function getDisplayName(ctx: Context): string {
  if (!ctx.path) return ctx.type;
  const trimmedPath = ctx.path.replace(/[/\\]+$/, '');
  const name = trimmedPath.split(/[/\\]/).pop() || ctx.path;
  if (ctx.type === ContextType.Selection && ctx.startLine != null && ctx.endLine != null) {
    return `${name}:${ctx.startLine}-${ctx.endLine}`;
  }
  if (ctx.path.endsWith('/') || ctx.path.endsWith('\\')) {
    return name + '/';
  }
  return name;
}

function handleOpenFile(filePath: string | undefined) {
  if (!filePath) return;
  getAdapter().openFile(filePath).catch((err) => {
    console.error('[ContextPills] Failed to open file:', err);
  });
}

function isFolder(ctx: Context): boolean {
  return !!ctx.path && (ctx.path.endsWith('/') || ctx.path.endsWith('\\'));
}

const FolderIcon = () => (
  <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const ContextPills: React.FC<ContextPillsProps> = ({ context }) => {
  if (!context || context.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {context.map((ctx, idx) => (
        <Tooltip key={ctx.path ? `${ctx.type}-${ctx.path}` : `ctx-${idx}`} content={ctx.path}>
          <div
            className="flex items-center gap-1.5 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 cursor-pointer hover:bg-zinc-700/50 hover:border-zinc-600 transition-colors"
            onClick={() => handleOpenFile(ctx.path)}
          >
            {isFolder(ctx) ? <FolderIcon /> : <FileIcon />}
            <span className="text-[11px] text-zinc-300 truncate max-w-[160px]">
              {getDisplayName(ctx)}
            </span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
};
