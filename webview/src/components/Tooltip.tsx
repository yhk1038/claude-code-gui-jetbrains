import type { ReactElement, ReactNode } from 'react';
import Tippy from '@tippyjs/react/headless';

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

export function Tooltip({ content, children, placement = 'top', disabled = false }: TooltipProps) {
  if (disabled || content == null || content === '') {
    return children;
  }

  return (
    <Tippy
      placement={placement}
      delay={[300, 0]}
      render={(attrs) => (
        <div
          className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-200 shadow-lg max-w-[480px] break-all font-mono z-[9999]"
          {...attrs}
        >
          {content}
        </div>
      )}
    >
      {children}
    </Tippy>
  );
}
