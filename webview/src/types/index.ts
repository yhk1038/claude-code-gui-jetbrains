/**
 * Type definitions for WebView
 * Re-exports from DTO classes for backwards compatibility
 */

// Re-export all DTO types
export * from '../dto';

// ============================================
// Legacy interface definitions for compatibility
// These will be gradually replaced by DTO classes
// ============================================

import type { AnyContentBlockDto } from '../dto';

export type ThemeMode = 'light' | 'dark';

/**
 * Message interface - supports both legacy string content and new ContentBlock array
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** Legacy: string content, New: ContentBlockDto array */
  content: string | AnyContentBlockDto[];
  timestamp: number | string;
  isStreaming?: boolean;
  toolUses?: ToolUse[];
  context?: Context[];
  images?: MessageImage[];
  /** New: original message_id from CLI */
  message_id?: string;
  /** New: original type from CLI */
  type?: 'user' | 'assistant' | 'system' | 'result';
}

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
 * Extract text content from Message (handles both formats)
 */
export function getTextContent(message: Message): string {
  if (isStringContent(message.content)) {
    return message.content;
  }

  if (isContentBlockArray(message.content)) {
    return message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  return '';
}

/**
 * Extract tool uses from Message content
 */
export function getToolUses(message: Message): Array<{ id: string; name: string; input: Record<string, unknown> }> {
  if (!isContentBlockArray(message.content)) {
    return message.toolUses || [];
  }

  return message.content
    .filter((block): block is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      block.type === 'tool_use'
    )
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input,
    }));
}
