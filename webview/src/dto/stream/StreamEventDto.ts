import { Transform } from 'class-transformer';
import { transformDelta } from '../../mappers/deltaTransformer';

/**
 * Text delta for streaming
 */
export class TextDeltaDto {
  type: 'text_delta' = 'text_delta';
  text!: string;
}

/**
 * Tool use delta for streaming
 */
export class ToolUseDeltaDto {
  type: 'tool_use_delta' = 'tool_use_delta';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export type AnyDeltaDto = TextDeltaDto | ToolUseDeltaDto;

/**
 * Stream event from Claude CLI JSONL
 */
export class StreamEventDto {
  type: 'stream_event' = 'stream_event';
  event!: string;
  index?: number;

  @Transform(({ value }) => transformDelta(value))
  delta?: AnyDeltaDto;
}

/**
 * Content block start event
 */
export class ContentBlockStartDto {
  type!: string;
  index!: number;
  content_block!: {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
}

/**
 * Content block stop event
 */
export class ContentBlockStopDto {
  type!: string;
  index!: number;
}
