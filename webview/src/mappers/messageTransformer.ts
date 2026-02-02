import { plainToInstance } from 'class-transformer';
import {
  AnyMessageDto,
  UserMessageDto,
  AssistantMessageDto,
  SystemMessageDto,
  ResultMessageDto,
} from '../dto/message/MessageDto';

/**
 * Transform raw messages array to typed DTO instances
 */
export function transformMessages(value: unknown): AnyMessageDto[] {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  return value.map((msg) => transformSingleMessage(msg));
}

/**
 * Transform a single message based on its type
 */
function transformSingleMessage(msg: unknown): AnyMessageDto {
  if (!msg || typeof msg !== 'object') {
    // Fallback: create a system message with error
    return plainToInstance(SystemMessageDto, {
      type: 'system',
      session_id: 'unknown',
      timestamp: new Date().toISOString(),
      content: `Invalid message: ${String(msg)}`,
    });
  }

  const msgObj = msg as Record<string, unknown>;
  const type = msgObj.type;

  switch (type) {
    case 'user':
      return plainToInstance(UserMessageDto, msg);

    case 'assistant':
      return plainToInstance(AssistantMessageDto, msg);

    case 'system':
      return plainToInstance(SystemMessageDto, msg);

    case 'result':
      return plainToInstance(ResultMessageDto, msg);

    default:
      // Unknown type - create system message with warning
      console.warn('Unknown message type:', type);
      return plainToInstance(SystemMessageDto, {
        type: 'system',
        session_id: 'unknown',
        timestamp: new Date().toISOString(),
        content: `Unknown message type: ${type}`,
      });
  }
}
