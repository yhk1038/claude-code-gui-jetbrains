import { AUTO_SCROLL_THRESHOLD_DEFAULT } from '@/utils/autoScroll';

/**
 * 설정 키 정의 - Kotlin SettingsManager와 동기화 (settings.js 파일 기반)
 */
export enum SettingKey {
  // CLI
  CLI_PATH = 'cliPath',
  NODE_PATH = 'nodePath',

  // Appearance
  THEME = 'theme',
  FONT_SIZE = 'fontSize',
  AUTO_SCROLL_THRESHOLD = 'autoScrollThreshold',

  // Advanced
  DEBUG_MODE = 'debugMode',
  LOG_LEVEL = 'logLevel',

  // Terminal
  TERMINAL_APP = 'terminalApp',

  // Host
  HOST_MODE = 'hostMode',

  // Settings screen open mode
  OPEN_SETTINGS_AS = 'openSettingsAs',

  // Chat history paging
  CHAT_PAGINATION = 'chatPagination',
}

/**
 * How the Settings screen opens from the gear button:
 * - overlay: a modal over the current session (keeps a running session mounted)
 * - new-tab: a dedicated editor tab / browser tab (the legacy openSettings path)
 */
export enum OpenSettingsMode {
  OVERLAY = 'overlay',
  NEW_TAB = 'new-tab',
}

/**
 * 채팅을 띄우는 자리(호스트) - Kotlin HostMode / 백엔드 hostMode 와 동기화.
 */
export enum HostMode {
  EDITOR_TAB = 'editor-tab',
  TOOL_WINDOW = 'tool-window',
}

/**
 * 테마 모드 Enum - 기존 types/index.ts의 'light' | 'dark' 타입을 대체
 */
export enum ThemeMode {
  SYSTEM = 'system',
  LIGHT = 'light',
  DARK = 'dark',
}

/**
 * 로그 레벨 Enum
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 설정 상태 인터페이스
 */
export interface SettingsState {
  [SettingKey.CLI_PATH]: string | null;
  [SettingKey.NODE_PATH]: string | null;
  [SettingKey.THEME]: ThemeMode;
  [SettingKey.FONT_SIZE]: number;
  [SettingKey.AUTO_SCROLL_THRESHOLD]: number;
  [SettingKey.DEBUG_MODE]: boolean;
  [SettingKey.LOG_LEVEL]: LogLevel;
  [SettingKey.TERMINAL_APP]: string | null;
  [SettingKey.HOST_MODE]: HostMode;
  [SettingKey.OPEN_SETTINGS_AS]: OpenSettingsMode;
  [SettingKey.CHAT_PAGINATION]: boolean;
}

/**
 * 설정 기본값
 */
export const DEFAULT_SETTINGS: SettingsState = {
  [SettingKey.CLI_PATH]: null,
  [SettingKey.NODE_PATH]: null,
  [SettingKey.THEME]: ThemeMode.SYSTEM,
  [SettingKey.FONT_SIZE]: 13,
  [SettingKey.AUTO_SCROLL_THRESHOLD]: AUTO_SCROLL_THRESHOLD_DEFAULT,
  [SettingKey.DEBUG_MODE]: false,
  [SettingKey.LOG_LEVEL]: LogLevel.INFO,
  [SettingKey.TERMINAL_APP]: null,
  [SettingKey.HOST_MODE]: HostMode.EDITOR_TAB,
  [SettingKey.OPEN_SETTINGS_AS]: OpenSettingsMode.OVERLAY,
  [SettingKey.CHAT_PAGINATION]: true,
};
