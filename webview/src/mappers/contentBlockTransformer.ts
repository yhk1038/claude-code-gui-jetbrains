import { plainToInstance } from 'class-transformer';
import {
  AnyContentBlockDto,
  TextBlockDto,
  ToolUseBlockDto,
  ToolResultBlockDto,
  ImageBlockDto,
} from '../dto/message/ContentBlockDto';

/**
 * Transform raw content blocks to typed DTO instances
 * Handles both string (legacy) and array (standard) formats
 */
export function transformContentBlocks(
  value: unknown
): AnyContentBlockDto[] {
  // Legacy: string content is converted to a single TextBlock
  if (typeof value === 'string') {
    return [plainToInstance(TextBlockDto, { type: 'text', text: value })];
  }

  // Null/undefined returns empty array
  if (!value) return [];

  // Must be an array
  if (!Array.isArray(value)) {
    console.warn('Content blocks is not an array:', value);
    return [];
  }

  return value.map((block) => transformSingleBlock(block));
}

/**
 * Transform a single content block based on its type
 */
function transformSingleBlock(block: unknown): AnyContentBlockDto {
  if (!block || typeof block !== 'object') {
    // Fallback: treat as text
    return plainToInstance(TextBlockDto, {
      type: 'text',
      text: String(block),
    });
  }

  const blockObj = block as Record<string, unknown>;
  const type = blockObj.type;

  switch (type) {
    case 'text':
      return plainToInstance(TextBlockDto, block);

    case 'tool_use':
      return plainToInstance(ToolUseBlockDto, block);

    case 'tool_result':
      return plainToInstance(ToolResultBlockDto, block);

    case 'image':
      return plainToInstance(ImageBlockDto, block);

    default:
      // Unknown type - treat as text with stringified content
      console.warn('Unknown content block type:', type);
      return plainToInstance(TextBlockDto, {
        type: 'text',
        text: JSON.stringify(block),
      });
  }
}
