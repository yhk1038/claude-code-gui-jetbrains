import React from 'react';

interface MessageActionsProps {
  copied: boolean;
  onCopy: () => void;
  onRetry?: () => void;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  copied,
  onCopy,
  onRetry,
}) => {
  return (
    <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        onClick={onCopy}
        className="p-1 hover:bg-zinc-800/50 rounded transition-colors duration-150"
        title="Copy message"
      >
        {copied ? (
          <svg
            className="w-3.5 h-3.5 text-green-500"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 4L6 11L3 8" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4zm1 2h6v8H5V4z" />
            <path
              d="M11 0a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1H0a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h1V1a1 1 0 0 1 1-1h9z"
              opacity="0.4"
            />
          </svg>
        )}
      </button>

      {onRetry && (
        <button
          onClick={onRetry}
          className="p-1 hover:bg-zinc-800/50 rounded transition-colors duration-150"
          title="Retry"
        >
          <svg
            className="w-3.5 h-3.5 text-zinc-500"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 8a6 6 0 0 1 10-4.5M14 8a6 6 0 0 1-10 4.5" />
            <path d="M12 2v4h-4M4 14v-4h4" />
          </svg>
        </button>
      )}
    </div>
  );
};
