import { FolderIcon } from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  disabled: boolean;
  /** Surfaced when the current working directory is not the IDE project root. */
  showOffRootIndicator: boolean;
  title: string;
  onClick: () => void;
}

export function WorkingDirToggle(props: Props) {
  const { isOpen, disabled, showOffRootIndicator, title, onClick } = props;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        'relative p-1 rounded transition-colors text-text-secondary',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:text-text-primary hover:bg-surface-hover',
        isOpen ? 'bg-surface-hover text-text-primary' : '',
      ].join(' ')}
      title={title}
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      <FolderIcon className="w-5 h-5" />
      {showOffRootIndicator && (
        <span
          className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent-default"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
