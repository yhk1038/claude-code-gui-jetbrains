/**
 * Claude Code settings that sync with ~/.claude/settings.json
 *
 * Structure:
 * 1. .claude/settings.json (project - not yet implemented)
 * 2. ~/.claude-code-gui/settings.js (app)
 * 3. ~/.claude/settings.json (user)
 *
 * Priority: #1 > #2 > #3 (later will merge)
 */

export interface PermissionsConfig {
  defaultMode?: string;
  disableBypassPermissionsMode?: string;
  allow?: string[];
  deny?: string[];
  ask?: string[];
  additionalDirectories?: string[];
}

export interface ClaudeSettingsState {
  model: string | null; // full model ID like 'claude-opus-4-6' or null for default
  language: string | null; // Claude's preferred response language (e.g., "korean", "japanese")
  effortLevel: string | null; // CLI effort level — values sourced from ModelInfo.supportedEffortLevels; null = auto
  alwaysThinkingEnabled: boolean; // extended thinking always on
  preferFastMode: boolean; // fast output mode (Opus 4.6 only)
  permissions?: PermissionsConfig;
  [key: string]: unknown; // extensible for future settings
}

export const DEFAULT_CLAUDE_SETTINGS: ClaudeSettingsState = {
  model: null,
  language: null,
  effortLevel: null,
  alwaysThinkingEnabled: true,
  preferFastMode: false,
};
