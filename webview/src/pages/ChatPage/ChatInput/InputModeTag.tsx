import { InputMode, INPUT_MODES } from '../../../types/chatInput';
import { ModeIcon } from './ModeIcon';
import {Tag} from "@/pages/ChatPage/ChatInput/Tag.tsx";

interface InputModeTagProps {
  mode: InputMode;
  onClick: () => void;
}

export function InputModeTag({ mode, onClick }: InputModeTagProps) {
  const config = INPUT_MODES[mode];

  return (
      <Tag title={config.description} onClick={onClick}>
        <ModeIcon mode={mode} className="w-5 h-5" />
        <span>{config.label}</span>
      </Tag>
  );
}
