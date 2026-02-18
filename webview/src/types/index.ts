/**
 * Type definitions for WebView
 * Re-exports from DTO classes for backwards compatibility
 */

// Re-export all DTO types
export * from '../dto';

// ============================================
// Message DTO definitions (JSONL-aligned)
// ============================================

import type { AnyContentBlockDto } from '@/dto';
import { Transform, Type } from 'class-transformer';
import { transformContentBlocks } from '../mappers/contentBlockTransformer';

/**
 * MessageDto = JSONL `message` sub-object (Claude API message format)
 *
 * Matches the structure of the `message` field inside each JSONL line.
 * `@Transform` on `content` runs only when `plainToInstance()` is called.
 */
export class MessageDto {
  role!: 'user' | 'assistant';

  @Transform(({ value }) => {
    if (typeof value === 'string' || !value) return value;
    if (Array.isArray(value)) return transformContentBlocks(value);
    return value;
  })
  content!: string | AnyContentBlockDto[];

  model?: string;
  id?: string;
  usage?: Record<string, unknown>;
  stop_reason?: string | null;
}

/**
 * LoadedMessageDto = one JSONL line from Claude CLI session file.
 *
 * This is the canonical message type that flows through the entire system:
 * backend → state → context → renderers.
 *
 * `@Type(() => MessageDto)` triggers nested `plainToInstance` for `message`,
 * which in turn triggers `@Transform` on `MessageDto.content`.
 */
export class LoadedMessageDto {
  type!: 'user' | 'assistant' | 'system' | 'result';
  uuid?: string;
  timestamp?: string;
  parentUuid?: string | null;
  isSidechain?: boolean;
  isMeta?: boolean;

  @Type(() => MessageDto)
  message?: MessageDto;

  message_id?: string;

  // result-specific
  subtype?: string;
  result?: unknown;
  toolUseResult?: unknown;

  // metadata
  slug?: string;
  sessionId?: string;

  // UI-only fields (not in JSONL, set during streaming/local creation)
  isStreaming?: boolean;
  context?: Context[];
  images?: MessageImage[];
}


// ============================================
// Supporting types
// ============================================

export interface MessageImage {
  type: 'base64' | 'url';
  mediaType: string;
  data: string;
  filename?: string;
}

export interface Context {
  type: 'selection' | 'file' | 'explicit';
  path?: string;
  content: string;
  startLine?: number;
  endLine?: number;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied' | 'executing' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface PendingDiff {
  id: string;
  filePath: string;
  diff: string;
  summary: DiffSummary;
  status: 'pending' | 'applied' | 'rejected';
  toolUseId: string;
  oldContent?: string;
  newContent?: string;
  operation?: 'MODIFY' | 'DELETE';
  oldString?: string;
  newString?: string;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  operation: 'create' | 'modify' | 'delete';
}

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export type SessionState = 'idle' | 'streaming' | 'waiting_permission' | 'has_diff' | 'error';

// ============================================
// Utility type guards
// ============================================

/**
 * Check if content is a ContentBlock array (new format)
 */
export function isContentBlockArray(content: unknown): content is AnyContentBlockDto[] {
  return Array.isArray(content) && content.length > 0 && typeof content[0] === 'object' && 'type' in content[0];
}

/**
 * Check if content is a simple string (legacy format)
 */
export function isStringContent(content: unknown): content is string {
  return typeof content === 'string';
}

/**
 * Extract text content from Message (handles both LoadedMessageDto structure)
 */
export function getTextContent(message: LoadedMessageDto): string {
  const content = message.message?.content;
  if (content === undefined || content === null) return '';

  if (isStringContent(content)) {
    return content;
  }

  if (isContentBlockArray(content)) {
    return content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Extract tool uses from Message content blocks.
 * Returns ToolUse[] with status based on message streaming state.
 */
export function getToolUses(message: LoadedMessageDto): ToolUse[] {
  const content = message.message?.content;
  if (!isContentBlockArray(content)) {
    return [];
  }

  return content
    .filter((block): block is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      block.type === 'tool_use'
    )
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input,
      status: message.isStreaming ? ('pending' as const) : ('completed' as const),
    }));
}

// Settings types
export * from './settings';
