import { InputMode, INPUT_MODES } from '../../types/chatInput';
import { PauseIcon, ForwardIcon, PencilIcon, ChevronDoubleRightIcon } from '@heroicons/react/16/solid';

interface InputModeTagProps {
  mode: InputMode;
  onClick: () => void;
}

const ModeIcon = ({ mode }: { mode: InputMode }) => {
  const iconClass = "w-3 h-3";

  switch (mode) {
    case 'plan':
      return <PauseIcon className={iconClass} />;
    case 'auto_edit':
      return <ForwardIcon className={iconClass} />;
    case 'ask_before_edit':
      return <PencilIcon className={iconClass} />;
    case 'bypass':
      return <ChevronDoubleRightIcon className={iconClass} />;
  }
};

export function InputModeTag({ mode, onClick }: InputModeTagProps) {
  const config = INPUT_MODES[mode];

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs font-medium text-zinc-400 transition-colors cursor-pointer hover:bg-zinc-800"
      title={config.description}
      onClick={onClick}
    >
      <ModeIcon mode={mode} />
      <span>{config.label}</span>
    </button>
  );
}
