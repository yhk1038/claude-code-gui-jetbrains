import type { FolderAttachment } from '../../../../types';

interface Props {
  attachment: FolderAttachment;
  onRemove: (id: string) => void;
}

export function FolderChip(props: Props) {
  const { attachment, onRemove } = props;

  return (
    <div className="relative group flex items-center gap-1.5 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1" title={attachment.absolutePath}>
      <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <span className="text-[11px] text-zinc-300 truncate max-w-[120px]">
        {attachment.displayLabel}
      </span>
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="w-5 h-5 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 text-sm leading-none shrink-0 transition-colors"
        aria-label={`Remove ${attachment.displayLabel}`}
      >
        ✕
      </button>
    </div>
  );
}
