import React, { useEffect, useState } from 'react';
import { Streamdown } from 'streamdown';
import { isInsideCodeBlock, isMarkdownComplete } from '../utils/markdownParser';
import './streaming.css';

interface ThinkingStreamingMessageProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

export const ThinkingStreamingMessage: React.FC<ThinkingStreamingMessageProps> = ({
  content,
  isStreaming,
  className = '',
}) => {
  const [shouldAnimate, setShouldAnimate] = useState(isStreaming);
  const [isExpended, setIsExpended] = useState(false);
  const text = JSON.parse(content)['thinking'];

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
    <div className={`text-white/40 streaming-message ${className}`} onClick={() => console.log(text)}>
      <div>
        <div className="mb-0.5 cursor-pointer" onClick={() => setIsExpended(!isExpended)}>
          <div className="italic text-white/50 flex items-center gap-1">
            Thinking{isStreaming ? '...' : ''}
            <span className={`inline-block transition-transform duration-200 text-[0.7em] ${isExpended ? 'rotate-180' : ''}`}>▼</span>
          </div>
        </div>

        <div className={`${isExpended ? "" : "hidden"} thinking-message markdown-content ${shouldAnimate ? 'streaming-animate' : ''}`}>
          <Streamdown
              className="space-y-0"
              mode={isStreaming ? 'streaming' : 'static'}
              parseIncompleteMarkdown={isStreaming}
              isAnimating={isStreaming}
              shikiTheme={['github-dark', 'github-light']}
              controls={{
                code: true,
                table: true,
              }}
          >
            {text}
          </Streamdown>
        </div>
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
    </div>
  );
};
