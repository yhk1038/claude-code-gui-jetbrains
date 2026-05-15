import { useEffect, useRef, useState } from 'react';
import { Portal } from '@/components/Portal';

interface Props {
  initialTitle: string;
  onConfirm: (title: string) => Promise<void>;
  onCancel: () => void;
}

export function RenameSessionDialog(props: Props) {
  const { initialTitle, onConfirm, onCancel } = props;
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Session name cannot be empty.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onConfirm(trimmedTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename session.');
      setIsSaving(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={handleBackdropClick}
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-session-title"
          className="bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <h2 id="rename-session-title" className="text-md font-semibold text-zinc-100">
            Rename Session
          </h2>
          <label className="flex flex-col gap-2 text-sm text-zinc-300">
            Session name
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
              placeholder="Enter session name"
              disabled={isSaving}
            />
          </label>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
}
