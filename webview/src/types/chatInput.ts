// ============================================
// Chat Input Mode Types
// ============================================

export type InputMode =
  | 'plan'              // Plan mode - 회색
  | 'bypass'            // Bypass permissions - 빨간색
  | 'ask_before_edit'   // Ask before edits - 주황색
  | 'auto_edit';        // Edit automatically - 녹색

export interface InputModeConfig {
  id: InputMode;
  icon: string;           // 아이콘 문자 ("II", "»", "/", "▶▶")
  label: string;          // 표시 라벨
  description: string;    // 툴팁 설명
  borderColor: string;    // Tailwind 테두리 색상 클래스
  textColor: string;      // 텍스트 색상 클래스
  sendButtonBg: string;   // 전송 버튼 배경색
}

export const INPUT_MODES: Record<InputMode, InputModeConfig> = {
  plan: {
    id: 'plan',
    icon: 'II',
    label: 'Plan mode',
    description: 'Claude will explore the code and present a plan before editing. Click, or press Shift+Tab, to switch modes.',
    borderColor: 'border-zinc-700',
    textColor: 'text-zinc-400',
    sendButtonBg: 'bg-zinc-600 hover:bg-zinc-500',
  },
  bypass: {
    id: 'bypass',
    icon: '»',
    label: 'Bypass permissions',
    description: 'Claude Code will not ask for your approval before running potentially dangerous commands.',
    borderColor: 'border-red-500/70',
    textColor: 'text-red-400',
    sendButtonBg: 'bg-red-500 hover:bg-red-400',
  },
  ask_before_edit: {
    id: 'ask_before_edit',
    icon: '/',
    label: 'Ask before edits',
    description: 'Claude will ask before each edit. Click, or press Shift+Tab, to switch modes.',
    borderColor: 'border-amber-500/70',
    textColor: 'text-amber-400',
    sendButtonBg: 'bg-amber-500 hover:bg-amber-400',
  },
  auto_edit: {
    id: 'auto_edit',
    icon: '▶▶',
    label: 'Edit automatically',
    description: 'Claude will edit your selected text or the whole file. Click, or press Shift+Tab, to switch modes.',
    borderColor: 'border-green-500/70',
    textColor: 'text-green-400',
    sendButtonBg: 'bg-green-500 hover:bg-green-400',
  },
};

// 모드 순환 순서
export const MODE_CYCLE: InputMode[] = ['plan', 'ask_before_edit', 'auto_edit', 'bypass'];

// ============================================
// Active File Types (IDE에서 전달받을 타입)
// ============================================

export interface ActiveFile {
  path: string;           // 전체 경로
  fileName: string;       // 파일명만
  isSelected: boolean;    // 컨텍스트로 선택됨
}
