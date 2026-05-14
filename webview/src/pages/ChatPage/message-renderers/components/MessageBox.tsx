import React, { useState } from 'react';

interface MessageBoxProps {
  children: React.ReactNode;
  /** Max height when collapsed; click toggles expand for full content (default: true). */
  collapsible?: boolean;
  className?: string;
}

/**
 * 사용자 메시지 스타일의 박스 컴포넌트.
 * bg-zinc-800/80 border border-white/25 rounded-lg 스타일을 공유.
 * 기본: 높이 200px 초과 시 박스 안에서 세로 스크롤, 클릭 시 전체 펼침.
 */
export const MessageBox: React.FC<MessageBoxProps> = ({ children, collapsible = true, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-zinc-800/80 border border-white/25 rounded-lg px-[8px] py-[3.5px] ${
        collapsible && !isExpanded ? 'max-h-[200px] overflow-y-auto' : ''
      } ${className ?? ''}`}
      onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
    >
      {children}
    </div>
  );
};
