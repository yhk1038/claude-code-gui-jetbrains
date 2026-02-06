import { InputMode, INPUT_MODES } from '../../types/chatInput';

interface InputModeTagProps {
  mode: InputMode;
  onClick: () => void;
}

export function InputModeTag({ mode, onClick }: InputModeTagProps) {
  const config = INPUT_MODES[mode];

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-opacity hover:opacity-70 cursor-pointer"
      title={config.description}
      onClick={onClick}
    >
      <span className="text-[11px]">{config.icon}</span>
      <span>{config.label}</span>
    </button>
  );
}
