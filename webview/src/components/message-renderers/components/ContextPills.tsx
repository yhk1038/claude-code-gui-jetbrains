import React from 'react';
import { Context } from '../../../types';
import { getAdapter } from '../../../adapters';

interface ContextPillsProps {
  context: Context[];
}

function getDisplayName(ctx: Context): string {
  if (!ctx.path) return ctx.type;
  const filename = ctx.path.split('/').pop() || ctx.path;
  if (ctx.type === 'selection' && ctx.startLine != null && ctx.endLine != null) {
    return `${filename}:${ctx.startLine}-${ctx.endLine}`;
  }
  return filename;
}

function handleOpenFile(filePath: string | undefined) {
  if (!filePath) return;
  getAdapter().openFile(filePath).catch((err) => {
    console.error('[ContextPills] Failed to open file:', err);
  });
}

export const ContextPills: React.FC<ContextPillsProps> = ({ context }) => {
  if (!context || context.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {context.map((ctx, idx) => (
        <div
          key={ctx.path ? `${ctx.type}-${ctx.path}` : `ctx-${idx}`}
          className="text-[10px] text-white/40 flex items-center gap-2 cursor-pointer hover:text-white/60 transition-colors"
          title={ctx.path}
          onClick={() => handleOpenFile(ctx.path)}
        >
          <span className="truncate max-w-[200px]">
            {getDisplayName(ctx)}
          </span>
        </div>
      ))}
    </div>
  );
};
