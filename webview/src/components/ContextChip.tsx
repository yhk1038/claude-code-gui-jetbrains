import { AttachedContext } from '../hooks/useContext';
import { ContextType } from '../types';

interface ContextChipProps {
  context: AttachedContext;
  onRemove: (id: string) => void;
}

export function ContextChip({ context, onRemove }: ContextChipProps) {
  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const iconColor = getIconColor(ext || '');

    return (
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 2a1 1 0 0 1 1-1h5.586a1 1 0 0 1 .707.293l2.414 2.414A1 1 0 0 1 13 4.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2z"
          fill={iconColor}
          opacity="0.2"
        />
        <path
          d="M3 2a1 1 0 0 1 1-1h5.586a1 1 0 0 1 .707.293l2.414 2.414A1 1 0 0 1 13 4.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2z"
          stroke={iconColor}
          strokeWidth="1.5"
        />
        <path d="M9 2v3h3" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  };

  const getIconColor = (ext: string) => {
    const colors: Record<string, string> = {
      ts: '#3178c6',
      tsx: '#3178c6',
      js: '#f7df1e',
      jsx: '#f7df1e',
      py: '#3776ab',
      java: '#007396',
      kt: '#7f52ff',
      go: '#00add8',
      rs: '#dea584',
      cpp: '#00599c',
      c: '#a8b9cc',
      json: '#5a5a5a',
      md: '#083fa1',
      css: '#1572b6',
      html: '#e34f26',
    };
    return colors[ext] || '#71717a'; // zinc-500
  };

  const getContextLabel = () => {
    const fileName = context.path.split('/').pop() || context.path;

    if (context.type === ContextType.Selection && context.startLine !== undefined && context.endLine !== undefined) {
      return `${fileName}:${context.startLine}-${context.endLine}`;
    }

    return fileName;
  };

  const getContextTypeIcon = () => {
    if (context.type === ContextType.Selection) {
      return (
        <svg className="w-3 h-3 text-blue-400" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z" />
        </svg>
      );
    }
    if (context.type === 'active') {
      return (
        <svg className="w-3 h-3 text-green-400" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="3" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800/80 border border-zinc-700/50 rounded-lg hover:border-zinc-600/50 transition-colors group">
      <div className="flex items-center gap-1.5">
        {getContextTypeIcon()}
        {getFileIcon(context.path)}
        <span className="text-xs text-zinc-300 font-mono max-w-[200px] truncate">
          {getContextLabel()}
        </span>
      </div>
      <button
        onClick={() => onRemove(context.id)}
        className="ml-1 p-0.5 rounded hover:bg-zinc-700/50 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Remove context"
      >
        <svg className="w-3 h-3 text-zinc-400 hover:text-zinc-200" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
