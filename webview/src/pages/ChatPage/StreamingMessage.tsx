import React, {useEffect, useState} from 'react';
import {Streamdown} from 'streamdown';
import {math} from '@streamdown/math';
import 'katex/dist/katex.min.css';
import {isInsideCodeBlock, isMarkdownComplete} from '../../utils/markdownParser';
import './streaming.css';
import {ToolWrapper} from "@/pages/ChatPage/message-renderers/ToolRenderers/common";

interface StreamingMessageProps {
    content: string;
    isStreaming: boolean;
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

export const StreamingMessage: React.FC<StreamingMessageProps> = ({
    content,
    isStreaming,
    className = '',
    message,
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
        <ToolWrapper message={message} className="!mt-0">
            <div className={`streaming-message ${className}`}>
                <div className={`markdown-content ${shouldAnimate ? 'streaming-animate' : ''}`}>
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
                        {normalizeRelativeUrls(content)}
                    </Streamdown>
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
