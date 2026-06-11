import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { SelectMenu } from './SelectMenu';
import type { SelectOption } from './types';

export * from './types';

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Styling for the trigger button (background, border, padding, text color). */
  className?: string;
  ariaLabel?: string;
}

/**
 * Custom dropdown that replaces the native `<select>`.
 *
 * Native `<select>` popups are drawn by the OS as a separate window, which
 * JCEF windowed (non-OSR) rendering positions incorrectly — the list shows up
 * detached from the trigger while the hitbox stays in place (issue #96). This
 * component renders its option list as plain DOM, so it never detaches.
 */
export function Select(props: Props) {
  const { value, options, onChange, disabled = false, className = '', ariaLabel } = props;
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  const handleSelect = (next: string) => {
    onChange(next);
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setIsOpen((open) => !open);
        }}
        className={`inline-flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          selected?.italic ? 'italic' : ''
        } ${className}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDownIcon
          className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <SelectMenu
          options={options}
          value={value}
          anchorRef={triggerRef}
          menuRef={menuRef}
          onSelect={handleSelect}
        />
      )}
    </>
  );
}
