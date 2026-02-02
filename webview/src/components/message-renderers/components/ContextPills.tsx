import React from 'react';
import { Context } from '../../../types';

interface ContextPillsProps {
  context: Context[];
}

export const ContextPills: React.FC<ContextPillsProps> = ({ context }) => {
  if (!context || context.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {context.map((ctx, idx) => (
        <div
          key={idx}
          className="px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-md text-xs text-zinc-400 font-mono flex items-center gap-2"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4zm1 2h6v8H5V4z" />
          </svg>
          <span className="truncate max-w-[200px]">
            {ctx.path || ctx.type}
          </span>
        </div>
      ))}
    </div>
  );
};
