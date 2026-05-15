import type { FileAttachment } from '../../../../types';

interface Props {
  attachment: FileAttachment;
  onRemove: (id: string) => void;
}

export function FileChip(props: Props) {
  const { attachment, onRemove } = props;

  return (
    <div className="relative group flex items-center gap-1.5 rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1" title={attachment.absolutePath}>
      <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
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
