import { useState, useCallback } from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  onRetry?: (messageId: string) => void;
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [message.content]);


  if (isSystem) {
    return (
      <div className="flex justify-center py-3">
        <div className="px-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-400 font-mono">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`group py-2 px-4 ${isUser ? 'pl-8' : 'pl-4'}`}>
      <div className="flex items-start gap-2">
        {/* Minimal bullet indicator */}
        <span className="text-zinc-500 mt-0.5 text-sm">•</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {message.isStreaming && (
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-75" />
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse delay-150" />
            </div>
          )}

          <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content || (
              <span className="text-zinc-600 italic">Thinking...</span>
            )}
          </div>

          {/* Context Pills */}
          {message.context && message.context.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.context.map((ctx, idx) => (
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
          )}
        </div>

        {/* Actions - more subtle */}
        <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-zinc-800/50 rounded transition-colors duration-150"
            title="Copy message"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 4L6 11L3 8" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4zm1 2h6v8H5V4z" />
                <path d="M11 0a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1H0a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h1V1a1 1 0 0 1 1-1h9z" opacity="0.4" />
              </svg>
            )}
          </button>

          {!isUser && onRetry && (
            <button
              onClick={() => onRetry(message.id)}
              className="p-1 hover:bg-zinc-800/50 rounded transition-colors duration-150"
              title="Retry"
            >
              <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8a6 6 0 0 1 10-4.5M14 8a6 6 0 0 1-10 4.5" />
                <path d="M12 2v4h-4M4 14v-4h4" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
