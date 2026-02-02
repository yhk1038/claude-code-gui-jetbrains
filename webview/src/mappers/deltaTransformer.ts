import { plainToInstance } from 'class-transformer';
import {
  AnyDeltaDto,
  TextDeltaDto,
  ToolUseDeltaDto,
} from '../dto/stream/StreamEventDto';

/**
 * Transform raw delta to typed DTO instance
 */
export function transformDelta(value: unknown): AnyDeltaDto | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const deltaObj = value as Record<string, unknown>;
  const type = deltaObj.type;

  switch (type) {
    case 'text_delta':
      return plainToInstance(TextDeltaDto, value);

    case 'tool_use_delta':
    case 'input_json_delta':
      return plainToInstance(ToolUseDeltaDto, value);

    default:
      // Unknown delta type - try to determine from content
      if ('text' in deltaObj) {
        return plainToInstance(TextDeltaDto, {
          type: 'text_delta',
          text: deltaObj.text,
        });
      }
      if ('id' in deltaObj || 'name' in deltaObj || 'input' in deltaObj) {
        return plainToInstance(ToolUseDeltaDto, {
          type: 'tool_use_delta',
          ...deltaObj,
        });
      }

      console.warn('Unknown delta type:', type);
      return undefined;
  }
}
