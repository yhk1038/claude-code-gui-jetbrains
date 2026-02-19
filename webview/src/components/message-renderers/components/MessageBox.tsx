import React, { useState } from 'react';

interface MessageBoxProps {
  children: React.ReactNode;
  /** 최대 높이 제한 활성화 (기본: true). true면 280px 초과 시 접힘 */
  collapsible?: boolean;
  className?: string;
}

/**
 * 사용자 메시지 스타일의 박스 컴포넌트.
 * bg-zinc-800/80 border border-white/25 rounded-lg 스타일을 공유.
 */
export const MessageBox: React.FC<MessageBoxProps> = ({ children, collapsible = true, className }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-zinc-800/80 border border-white/25 rounded-lg px-[8px] py-[3.5px] ${
        collapsible && !isExpanded ? 'max-h-[280px] overflow-hidden' : ''
      } ${className ?? ''}`}
      onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
    >
      {children}
    </div>
  );
};
