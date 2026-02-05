interface DropdownToggleProps {
  sessionTitle: string;
  isOpen: boolean;
  onClick: () => void;
}

export function DropdownToggle({ sessionTitle, isOpen, onClick }: DropdownToggleProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 text-[13px] text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/50 rounded transition-colors"
    >
      <span className="max-w-[300px] truncate">{sessionTitle || 'New Chat'}</span>
      <svg
        className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M4.427 6.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 6H4.604a.25.25 0 0 0-.177.427z" />
      </svg>
    </button>
  );
}
