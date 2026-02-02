import { BridgeClient } from '../bridge/BridgeClient';
import { DtoMapper } from '../../mappers/DtoMapper';
import {
  AssistantMessageDto,
  ResultMessageDto,
  StreamEventDto,
  AnyContentBlockDto,
} from '../../dto';
import { transformContentBlocks } from '../../mappers/contentBlockTransformer';

interface StreamEventPayload {
  event?: string;
  eventType?: string;
  index?: number;
  delta?: unknown;
  content?: unknown;
  sessionId?: string;
  timestamp?: string;
}

interface AssistantMessagePayload {
  messageId: string;
  content: unknown[];
}

interface ResultMessagePayload {
  status: 'success' | 'error';
  messageId?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Messages API module
 * Handles message sending and streaming
 */
export class MessagesApi {
  constructor(private bridge: BridgeClient) {}

  /**
   * Send a message to the assistant
   */
  async send(content: string): Promise<void> {
    await this.bridge.request('SEND_MESSAGE', { content });
  }

  /**
   * Subscribe to stream events (text deltas, tool use deltas)
   */
  onStreamEvent(callback: (event: StreamEventDto) => void): () => void {
    return this.bridge.subscribe('STREAM_EVENT', (message) => {
      const payload = message.payload as StreamEventPayload;
      const dto = DtoMapper.map(payload, StreamEventDto);
      callback(dto);
    });
  }

  /**
   * Subscribe to assistant messages (complete responses)
   */
  onAssistantMessage(callback: (msg: AssistantMessageDto) => void): () => void {
    return this.bridge.subscribe('ASSISTANT_MESSAGE', (message) => {
      const payload = message.payload as unknown as AssistantMessagePayload;

      const dto = new AssistantMessageDto();
      dto.message_id = payload.messageId;
      dto.content = transformContentBlocks(payload.content);

      callback(dto);
    });
  }

  /**
   * Subscribe to result messages (completion)
   */
  onResult(callback: (result: ResultMessageDto) => void): () => void {
    return this.bridge.subscribe('RESULT_MESSAGE', (message) => {
      const payload = message.payload as unknown as ResultMessagePayload;
      const dto = DtoMapper.map(payload, ResultMessageDto);
      callback(dto);
    });
  }

  /**
   * Subscribe to service errors
   */
  onError(callback: (error: { type: string; message: string }) => void): () => void {
    return this.bridge.subscribe('SERVICE_ERROR', (message) => {
      callback({
        type: message.payload?.type as string || 'unknown',
        message: message.payload?.message as string || 'Unknown error',
      });
    });
  }

  // Promise-based waiting methods

  /**
   * Wait for the next result message
   */
  waitForResult(timeout = 60000): Promise<ResultMessageDto> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error('Timeout waiting for result'));
      }, timeout);

      const unsubscribe = this.onResult((result) => {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(result);
      });
    });
  }

  /**
   * Wait for the next assistant message
   */
  waitForAssistantMessage(timeout = 60000): Promise<AssistantMessageDto> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error('Timeout waiting for assistant message'));
      }, timeout);

      const unsubscribe = this.onAssistantMessage((msg) => {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(msg);
      });
    });
  }

  /**
   * Send message and wait for result (chaining pattern)
   */
  async sendAndWait(content: string, timeout = 60000): Promise<ResultMessageDto> {
    const resultPromise = this.waitForResult(timeout);
    await this.send(content);
    return resultPromise;
  }

  /**
   * Collect all stream events until result
   * Returns accumulated content blocks
   */
  async sendAndCollect(content: string, timeout = 60000): Promise<{
    contentBlocks: AnyContentBlockDto[];
    result: ResultMessageDto;
  }> {
    const contentBlocks: AnyContentBlockDto[] = [];

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribeStream();
        unsubscribeResult();
        reject(new Error('Timeout waiting for response'));
      }, timeout);

      const unsubscribeStream = this.onAssistantMessage((msg) => {
        contentBlocks.push(...msg.content);
      });

      const unsubscribeResult = this.onResult((result) => {
        clearTimeout(timeoutId);
        unsubscribeStream();
        unsubscribeResult();
        resolve({ contentBlocks, result });
      });

      this.send(content).catch((error) => {
        clearTimeout(timeoutId);
        unsubscribeStream();
        unsubscribeResult();
        reject(error);
      });
    });
  }
}
