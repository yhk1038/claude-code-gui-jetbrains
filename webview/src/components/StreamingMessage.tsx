import React, { useEffect, useState } from 'react';
import { Streamdown } from 'streamdown';
import { isInsideCodeBlock, isMarkdownComplete } from '../utils/markdownParser';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
  content,
  isStreaming,
  className = '',
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(isStreaming);

  // Handle streaming animation
  useEffect(() => {
    if (isStreaming) {
      setShouldAnimate(true);
    } else {
      // Keep animation for a short period after streaming ends
      const timer = setTimeout(() => setShouldAnimate(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  // Determine if we should show incomplete indicator
  const showIncompleteIndicator = isStreaming && !isMarkdownComplete(content) && isInsideCodeBlock(content);

  return (
    <div className={`streaming-message ${className}`}>
      <div className={`markdown-content ${shouldAnimate ? 'streaming-animate' : ''}`}>
        <Streamdown
          mode={isStreaming ? 'streaming' : 'static'}
          parseIncompleteMarkdown={isStreaming}
          isAnimating={isStreaming}
          shikiTheme={['github-dark', 'github-light']}
          controls={{
            code: true,
            table: true,
          }}
        >
          {content}
        </Streamdown>
      </div>

      {showIncompleteIndicator && (
        <div className="incomplete-indicator">
          <span className="cursor-blink">▋</span>
        </div>
      )}

      {isStreaming && (
        <div className="streaming-indicator">
          <span className="dot-pulse" />
        </div>
      )}

      <style>{`
        .streaming-message {
          position: relative;
          font-family: var(--ide-font-ui);
          color: var(--ide-fg);
          line-height: 1.6;
        }

        .markdown-content {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }

        .streaming-animate {
          animation: fadeIn 0.2s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0.8;
          }
          to {
            opacity: 1;
          }
        }

        .incomplete-indicator {
          display: inline-block;
          margin-left: 2px;
        }

        .cursor-blink {
          animation: blink 1s step-end infinite;
          color: var(--ide-accent);
        }

        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0;
          }
        }

        .streaming-indicator {
          position: absolute;
          bottom: -20px;
          left: 0;
          display: flex;
          align-items: center;
          opacity: 0.6;
        }

        .dot-pulse {
          position: relative;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--ide-accent);
          animation: dotPulse 1.5s ease-in-out infinite;
        }

        .dot-pulse::before,
        .dot-pulse::after {
          content: '';
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--ide-accent);
          animation: dotPulse 1.5s ease-in-out infinite;
        }

        .dot-pulse::before {
          left: -10px;
          animation-delay: -0.3s;
        }

        .dot-pulse::after {
          left: 10px;
          animation-delay: 0.3s;
        }

        @keyframes dotPulse {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};
