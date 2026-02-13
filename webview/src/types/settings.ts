import type { InputMode } from './chatInput';

/**
 * 설정 키 정의 - Kotlin ClaudeCodeSettings.State와 동기화
 */
export enum SettingKey {
  // CLI
  CLI_PATH = 'cliPath',

  // Permissions
  PERMISSION_MODE = 'permissionMode',
  AUTO_APPLY_LOW_RISK = 'autoApplyLowRisk',

  // Appearance
  THEME = 'theme',
  FONT_SIZE = 'fontSize',

  // Advanced
  DEBUG_MODE = 'debugMode',
  LOG_LEVEL = 'logLevel',

  // Input
  INITIAL_INPUT_MODE = 'initialInputMode',
}

/**
 * 권한 모드 Enum
 */
export enum PermissionMode {
  ALWAYS_ASK = 'ALWAYS_ASK',
  AUTO_APPROVE_SAFE = 'AUTO_APPROVE_SAFE',
  AUTO_APPROVE_ALL = 'AUTO_APPROVE_ALL',
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
  [SettingKey.PERMISSION_MODE]: PermissionMode;
  [SettingKey.AUTO_APPLY_LOW_RISK]: boolean;
  [SettingKey.THEME]: ThemeMode;
  [SettingKey.FONT_SIZE]: number;
  [SettingKey.DEBUG_MODE]: boolean;
  [SettingKey.LOG_LEVEL]: LogLevel;
  [SettingKey.INITIAL_INPUT_MODE]: InputMode;
}

/**
 * 설정 기본값
 */
export const DEFAULT_SETTINGS: SettingsState = {
  [SettingKey.CLI_PATH]: null,
  [SettingKey.PERMISSION_MODE]: PermissionMode.ALWAYS_ASK,
  [SettingKey.AUTO_APPLY_LOW_RISK]: false,
  [SettingKey.THEME]: ThemeMode.SYSTEM,
  [SettingKey.FONT_SIZE]: 13,
  [SettingKey.DEBUG_MODE]: false,
  [SettingKey.LOG_LEVEL]: LogLevel.INFO,
  [SettingKey.INITIAL_INPUT_MODE]: 'ask_before_edit',
};
