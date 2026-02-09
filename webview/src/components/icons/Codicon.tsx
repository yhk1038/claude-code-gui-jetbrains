import React from 'react';

interface CodiconProps {
  /** Codicon 이름 (예: 'add', 'close', 'folder-open') */
  icon: string;
  /** CSS 클래스 (Tailwind 가능) */
  className?: string;
  /** 사이즈 (px 단위, 기본 16) */
  size?: number;
}

export const Codicon: React.FC<CodiconProps> = ({
  icon,
  className = '',
  size = 16,
}) => (
  <span
    className={`codicon codicon-${icon} ${className}`}
    style={{ fontSize: `${size}px` }}
  />
);
