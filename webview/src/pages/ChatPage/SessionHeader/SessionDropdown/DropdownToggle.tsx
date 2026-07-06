import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useTranslation } from '@/i18n';

interface DropdownToggleProps {
  sessionTitle: string;
  isOpen: boolean;
  onClick: () => void;
}

export function DropdownToggle({ sessionTitle, isOpen, onClick }: DropdownToggleProps) {
  const { t } = useTranslation('chat');
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 text-[1rem] text-text-primary hover:bg-surface-hover rounded transition-colors min-w-0 max-w-full"
    >
      <span className="min-w-0 max-w-[260px] truncate">
        {sessionTitle || t('sessionHeader.sessionDropdown.newChat')}
      </span>
      <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );
}
