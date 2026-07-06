import { useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n';
import { Portal } from '../Portal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: Props) {
  const { t } = useTranslation('common');
  const {
    title,
    message,
    confirmLabel = t('confirmDialog.confirm'),
    cancelLabel = t('confirmDialog.cancel'),
    variant = 'default',
    onConfirm,
    onCancel,
  } = props;

  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management for the lifetime of the dialog:
  //  1. Remember the opener (typically the chat input) BEFORE moving focus, so
  //     we can hand it back on close. Captured here — not via autoFocus — because
  //     autoFocus runs before effects and would make us record the confirm button.
  //  2. Move focus to the confirm button, and trap it: the chat input underneath
  //     runs auto-focus timers (session change, window focus, …) that would yank
  //     focus back, leaving the dialog non-keyboard-operable and routing Enter to
  //     the input. If focus escapes the dialog while open, pull it back.
  //  3. On close (confirm OR cancel), restore focus to the opener so typing can
  //     resume immediately.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmButtonRef.current?.focus();

    const handleFocusIn = (e: FocusEvent) => {
      const dialog = dialogRef.current;
      if (dialog && e.target instanceof Node && !dialog.contains(e.target)) {
        confirmButtonRef.current?.focus();
      }
    };
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    // Only Escape is intercepted globally (capture phase, so it beats the chat
    // input underneath). Enter is deliberately NOT handled here: focus is trapped
    // inside the dialog, so Enter natively activates whichever button is focused —
    // Confirm or Cancel. Intercepting it would force-confirm even when the user
    // has Cancel focused.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onCancel]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const confirmButtonClass =
    variant === 'danger'
      ? 'px-4 py-2 rounded-lg text-sm font-medium bg-state-error-fg hover:bg-state-error-fg text-text-inverse transition-colors'
      : 'px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary-hover hover:bg-accent-primary text-text-primary transition-colors';

  return (
    <Portal>
      <div
        data-testid="confirm-dialog-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim"
        onClick={handleBackdropClick}
      >
        <div
          ref={dialogRef}
          role="dialog"
          className="bg-surface-raised border border-border-default rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"
        >
          <h2 className="text-md font-semibold text-text-primary">{title}</h2>
          <p className="text-sm text-text-secondary">{message}</p>
          <div className="flex justify-end gap-2 mt-2">
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tooltip transition-colors"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              className={confirmButtonClass}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
