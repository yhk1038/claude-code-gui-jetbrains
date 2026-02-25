// ============================================
// Chat Input Mode Types
// ============================================

export const InputModeValues = {
  PLAN: 'plan',
  BYPASS: 'bypass',
  ASK_BEFORE_EDIT: 'ask_before_edit',
  AUTO_EDIT: 'auto_edit',
} as const;

export type InputMode = typeof InputModeValues[keyof typeof InputModeValues];

export interface InputModeConfig {
  id: InputMode;
  icon: string;           // codicon 아이콘 이름 (예: 'tasklist', 'zap')
  label: string;          // 표시 라벨
  description: string;    // 툴팁 설명
  borderColor: string;    // Tailwind 테두리 색상 클래스
  textColor: string;      // 텍스트 색상 클래스
  hoverBg: string;        // 호버 시 배경색
  sendButtonBg: string;   // 전송 버튼 배경색
}

export const INPUT_MODES: Record<InputMode, InputModeConfig> = {
  plan: {
    id: 'plan',
    icon: 'tasklist',
    label: 'Plan mode',
    description: 'Claude will explore the code and present a plan before editing. Click, or press Shift+Tab, to switch modes.',
    borderColor: 'border-zinc-700',
    textColor: 'text-zinc-400',
    hoverBg: 'hover:bg-zinc-800',
    sendButtonBg: 'bg-zinc-600 hover:bg-zinc-500',
  },
  bypass: {
    id: 'bypass',
    icon: 'zap',
    label: 'Bypass permissions',
    description: 'Claude Code will not ask for your approval before running potentially dangerous commands.',
    borderColor: 'border-red-500/70',
    textColor: 'text-red-400',
    hoverBg: 'hover:bg-red-950/80',
    sendButtonBg: 'bg-red-500 hover:bg-red-400',
  },
  ask_before_edit: {
    id: 'ask_before_edit',
    icon: 'comment-discussion',
    label: 'Ask before edits',
    description: 'Claude will ask before each edit. Click, or press Shift+Tab, to switch modes.',
    borderColor: 'border-amber-500/70',
    textColor: 'text-amber-400',
    hoverBg: 'hover:bg-amber-950/80',
    sendButtonBg: 'bg-amber-500 hover:bg-amber-400',
  },
  auto_edit: {
    id: 'auto_edit',
    icon: 'robot',
    label: 'Edit automatically',
    description: 'Claude will edit your selected text or the whole file. Click, or press Shift+Tab, to switch modes.',
    borderColor: 'border-green-500/70',
    textColor: 'text-green-400',
    hoverBg: 'hover:bg-green-950/80',
    sendButtonBg: 'bg-green-500 hover:bg-green-400',
  },
};

// 모드 순환 순서
export const MODE_CYCLE: InputMode[] = [
  InputModeValues.PLAN,
  InputModeValues.BYPASS,
  InputModeValues.ASK_BEFORE_EDIT,
  InputModeValues.AUTO_EDIT,
];

/**
 * InputMode -> Claude CLI --permission-mode flag value mapping
 */
export const INPUT_MODE_TO_CLI_FLAG: Record<InputMode, string> = {
  [InputModeValues.PLAN]: 'plan',
  [InputModeValues.BYPASS]: 'bypassPermissions',
  [InputModeValues.ASK_BEFORE_EDIT]: 'default',
  [InputModeValues.AUTO_EDIT]: 'acceptEdits',
} as const;

// ============================================
// Active File Types (IDE에서 전달받을 타입)
// ============================================

export interface ActiveFile {
  path: string;           // 전체 경로
  fileName: string;       // 파일명만
  isSelected: boolean;    // 컨텍스트로 선택됨
}
