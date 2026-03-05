import { InputMode, INPUT_MODES } from '../../types/chatInput';

interface Props {
  mode: InputMode;
  isStreaming: boolean;
  isActive: boolean;
  isStopped: boolean;
  disabled: boolean;
  hasValue: boolean;
  onAttach?: () => void;
  onSlashCommand?: () => void;
  onSubmit: () => void;
  onStop?: () => void;
  onContinue?: () => void;
}

export function ActionButtons(props: Props) {
  const {
    mode,
    isStreaming,
    isActive,
    isStopped,
    disabled,
    hasValue,
    onAttach,
    onSlashCommand,
    onSubmit,
    onStop,
    onContinue,
  } = props;
  const config = INPUT_MODES[mode];

  return (
    <div className="flex items-center gap-1.5 pb-[1px]">
      <div className="flex items-center gap-0.5">
        {/* 클립(첨부) 버튼 */}
        <button
            type="button"
            className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-500 hover:text-zinc-400 hover:bg-white/10"
            onClick={onAttach}
            title="Attach file"
        >
          <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        {/* 슬래시 커맨드 버튼 */}
        <button
            type="button"
            className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-500 hover:text-zinc-400 hover:bg-white/10 text-sm font-medium"
            onClick={onSlashCommand}
            title="Slash commands"
        >
          /
        </button>
      </div>

      {/* 전송/정지/계속 버튼 */}
      {isActive && onStop ? (
        <button
          type="button"
          onClick={onStop}
          className="flex items-center justify-center w-[26px] h-[26px] rounded-md bg-red-500 hover:bg-red-400 text-white transition-colors"
          title="Stop generating"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <rect x="4" y="4" width="8" height="8" rx="1" />
          </svg>
        </button>
      ) : isStopped && !isActive && onContinue ? (
        <button
          type="button"
          onClick={onContinue}
          className="flex items-center justify-center w-[26px] h-[26px] rounded-md bg-blue-500 hover:bg-blue-400 text-white transition-colors"
          title="Continue generating"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 3l8 5-8 5V3z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || isStreaming || !hasValue}
          className={`
            flex items-center justify-center w-[26px] h-[26px] rounded-md transition-all
            ${config.sendButtonBg} text-white
            ${disabled || isStreaming || !hasValue
              ? 'opacity-40 cursor-not-allowed'
              : 'opacity-100'
            }
          `}
          title="Send message"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
