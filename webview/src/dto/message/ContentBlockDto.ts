import { Type } from 'class-transformer';

export type ContentBlockType = 'text' | 'tool_use' | 'tool_result' | 'image';

/**
 * Base class for all content blocks in Claude CLI messages
 */
export abstract class ContentBlockDto {
  type!: ContentBlockType;
}

/**
 * Text content block
 */
export class TextBlockDto extends ContentBlockDto {
  override type: 'text' = 'text';
  text!: string;
}

/**
 * Tool use content block - represents a tool call from the assistant
 */
export class ToolUseBlockDto extends ContentBlockDto {
  override type: 'tool_use' = 'tool_use';
  id!: string;
  name!: string;
  input!: Record<string, unknown>;
}

/**
 * Tool result content block - represents the result of a tool call
 */
export class ToolResultBlockDto extends ContentBlockDto {
  override type: 'tool_result' = 'tool_result';
  tool_use_id!: string;
  content!: string;
  is_error?: boolean;
}

/**
 * Image source DTO for base64 or URL images
 */
export class ImageSourceDto {
  type!: 'base64' | 'url';
  media_type!: string;
  data!: string;
}

/**
 * Image content block
 */
export class ImageBlockDto extends ContentBlockDto {
  override type: 'image' = 'image';

  @Type(() => ImageSourceDto)
  source!: ImageSourceDto;
}

export type AnyContentBlockDto =
  | TextBlockDto
  | ToolUseBlockDto
  | ToolResultBlockDto
  | ImageBlockDto;
