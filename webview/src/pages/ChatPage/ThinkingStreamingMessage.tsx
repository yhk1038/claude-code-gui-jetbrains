import React, {useEffect, useState} from 'react';
import {Streamdown} from 'streamdown';
import {math} from '../../utils/mathPlugin';
import {isInsideCodeBlock, isMarkdownComplete} from '../../utils/markdownParser';
import './streaming.css';
import {ToolWrapper} from "@/pages/ChatPage/message-renderers/ToolRenderers/common";
import {useChatStreamContext} from '../../contexts/ChatStreamContext';
import {formatThinkingTokens} from '../../utils/formatThinkingTokens';

interface ThinkingStreamingMessageProps {
    thinking: string;
    isStreaming: boolean;
    /** Live cumulative thinking-token estimate (shown only while actively thinking). */
    estimatedTokens?: number;
    /** Wall-clock duration (ms); its presence means the block is done thinking. */
    durationMillis?: number;
    className?: string;
    message?: import('../../types').LoadedMessageDto;
}

/**
 * Normalize bare relative URLs in markdown links so rehype-harden doesn't block them.
 * e.g., [file.tsx](src/file.tsx) → [file.tsx](./src/file.tsx)
 */
function normalizeRelativeUrls(markdown: string): string {
    // Match markdown links: [text](url)
    // But NOT image links: ![text](url)
    return markdown.replace(
        /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g,
        (match, text, url) => {
            // Skip if already has protocol, starts with /, ./, ../, or #
            if (
                /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || // has protocol
                url.startsWith('/') ||
                url.startsWith('./') ||
                url.startsWith('../') ||
                url.startsWith('#')
            ) {
                return match;
            }
            return `[${text}](./${url})`;
        }
    );
}

export const ThinkingStreamingMessage: React.FC<ThinkingStreamingMessageProps> = ({
    thinking,
    isStreaming,
    estimatedTokens,
    durationMillis,
    className = '',
    message,
}) => {
    const [shouldAnimate, setShouldAnimate] = useState(isStreaming);
    const { isThinkingExpanded, toggleThinkingExpanded } = useChatStreamContext();

    // The block is "still thinking" until its duration is stamped at content_block_stop.
    const isThinking = durationMillis === undefined && isStreaming;
    const label = durationMillis !== undefined
        ? `Thought for ${Math.round(durationMillis / 1000)}s`
        : isThinking
            ? 'Thinking...'
            : 'Thinking';
    // Live token count is only meaningful while actively thinking.
    const tokenText = isThinking ? formatThinkingTokens(estimatedTokens) : null;

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
    const showIncompleteIndicator = isStreaming && !isMarkdownComplete(thinking) && isInsideCodeBlock(thinking);

    return (
        <ToolWrapper message={message} className="mt-0">
            <div className={`text-text-primary/40 streaming-message ${className}`}>
                <div>
                    <div className="mb-0.5 cursor-pointer" onClick={toggleThinkingExpanded}>
                        <div className="italic text-text-primary/50 flex items-center gap-1">
                            {label}
                            {tokenText && (
                                <span className="not-italic tabular-nums opacity-80">· {tokenText}</span>
                            )}
                        </div>
                    </div>

                    <div
                        className={`${isThinkingExpanded ? "" : "hidden"} thinking-message markdown-content ${shouldAnimate ? 'streaming-animate' : ''}`}>
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
                            plugins={{ math }}
                        >
                            {normalizeRelativeUrls(thinking)}
                        </Streamdown>
                    </div>
                </div>

                {showIncompleteIndicator && (
                    <div className="incomplete-indicator">
                        <span className="cursor-blink">▋</span>
                    </div>
                )}

            </div>
        </ToolWrapper>
    );
};
