export enum ClaudeModel {
  DEFAULT = 'default',
  OPUS = 'opus',
  HAIKU = 'haiku',
  SONNET = 'sonnet',
}

export interface ClaudeModelDef {
  key: ClaudeModel;
  id: string | null;    // CLI에 넘기는 실제 모델 ID (null = default)
  label: string;        // UI 표시 이름
  description: string;  // 간략한 설명
}

export const CLAUDE_MODELS: ClaudeModelDef[] = [
  { key: ClaudeModel.DEFAULT, id: null,                         label: 'Default (recommended)', description: 'Uses CLI default for your plan' },
  { key: ClaudeModel.SONNET,  id: 'claude-sonnet-4-6',          label: 'Sonnet 4.6',            description: 'Best for everyday tasks' },
  { key: ClaudeModel.HAIKU,   id: 'claude-haiku-4-5-20251001',  label: 'Haiku 4.5',             description: 'Fastest for quick answers' },
  { key: ClaudeModel.OPUS,    id: 'claude-opus-4-6',            label: 'Opus 4.6',              description: 'Most capable for complex work' },
];

export function getModelDef(key: ClaudeModel): ClaudeModelDef {
  return CLAUDE_MODELS.find((m) => m.key === key) ?? CLAUDE_MODELS[0];
}

/**
 * Claude CLI가 반환하는 모델 문자열(예: 'claude-opus-4-6')을 ClaudeModel enum으로 변환.
 * 알 수 없는 값이면 null 반환.
 */
export function parseClaudeModel(model: string | null | undefined): ClaudeModel | null {
  if (!model) return null;
  if (model === 'default') return ClaudeModel.DEFAULT;
  const exact = CLAUDE_MODELS.find((m) => m.id === model);
  if (exact) return exact.key;
  // fallback: partial match
  if (model.includes('opus')) return ClaudeModel.OPUS;
  if (model.includes('haiku')) return ClaudeModel.HAIKU;
  if (model.includes('sonnet')) return ClaudeModel.SONNET;
  return null;
}
