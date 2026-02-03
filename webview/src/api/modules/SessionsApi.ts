import { plainToInstance } from 'class-transformer';
import { BridgeClient } from '../bridge/BridgeClient';
import {
  SessionMetaDto,
  SessionStreamMessageDto,
  AssistantMessageDto,
  ResultMessageDto,
} from '../../dto';
import { ContentBlockDeltaMessageDto } from '../../dto/stream/StreamEventDto';
import { transformMessages } from '../../mappers/messageTransformer';
import { transformContentBlocks } from '../../mappers/contentBlockTransformer';
import { AnyMessageDto } from '../../dto/message/MessageDto';
import type { ApiConfig } from '../ClaudeCodeApi';

interface GetSessionsResponse {
  sessions: {
    sessionId: string;
    firstPrompt?: string;
    created: string;
    modified: string;
    messageCount?: number;
    projectPath?: string;
    gitBranch?: string;
  }[];
}

interface LoadSessionResponse {
  sessionId: string;
  messages: unknown[];
}

/**
 * Sessions API module
 * RESTful CRUD operations for sessions
 *
 * Session is the parent resource of messages (1:N relationship)
 */
export class SessionsApi {
  private _unsubscribeCurrent: (() => void) | null = null;

  constructor(
    private bridge: BridgeClient,
    private getConfig: () => ApiConfig
  ) {}

  /**
   * List all sessions
   * GET /sessions
   */
  async index(): Promise<SessionMetaDto[]> {
    const { workingDir } = this.getConfig();
    const response = await this.bridge.request<GetSessionsResponse>(
      'GET_SESSIONS',
      { workingDir }
    );

    if (!response?.sessions || !Array.isArray(response.sessions)) {
      return [];
    }

    return plainToInstance(SessionMetaDto, response.sessions);
  }

  /**
   * Get a single session with its messages
   * GET /sessions/:id
   *
   * @param sessionId - Session ID to load
   * @param onMessage - Optional callback for streaming messages during session
   */
  async show(
    sessionId: string,
    onMessage?: (message: SessionStreamMessageDto) => void
  ): Promise<{ sessionId: string; messages: AnyMessageDto[] }> {
    // 이전 세션 구독 해제
    this._unsubscribeCurrent?.();

    const { workingDir } = this.getConfig();

    // Set up listener before sending request
    const messagesPromise = this.bridge.waitFor<LoadSessionResponse>(
      'SESSION_LOADED',
      30000
    );

    // Send load request
    await this.bridge.request('LOAD_SESSION', { sessionId, workingDir });

    // Wait for messages
    const response = await messagesPromise;

    // 새 세션 구독 설정 (onMessage가 제공된 경우)
    if (onMessage) {
      this._unsubscribeCurrent = this.subscribeToSession(sessionId, onMessage);
    }

    return {
      sessionId: response.sessionId,
      messages: transformMessages(response.messages),
    };
  }

  /**
   * Subscribe to session-specific messages
   * @private
   */
  private subscribeToSession(
    sessionId: string,
    onMessage: (message: SessionStreamMessageDto) => void
  ): () => void {
    const unsubscribers: (() => void)[] = [];

    // Content block delta 구독
    unsubscribers.push(
      this.bridge.subscribe('STREAM_EVENT', (msg) => {
        const payload = msg.payload as any;
        if (payload.sessionId && payload.sessionId !== sessionId) return;

        const dto = plainToInstance(ContentBlockDeltaMessageDto, {
          ...payload,
          sessionId,
        });
        onMessage(dto);
      })
    );

    // Assistant message 구독
    unsubscribers.push(
      this.bridge.subscribe('ASSISTANT_MESSAGE', (msg) => {
        const payload = msg.payload as any;
        if (payload.sessionId && payload.sessionId !== sessionId) return;

        const dto = new AssistantMessageDto();
        dto.sessionId = sessionId;
        dto.messageId = payload.messageId;
        dto.content = transformContentBlocks(payload.content);
        onMessage(dto);
      })
    );

    // Result message 구독
    unsubscribers.push(
      this.bridge.subscribe('RESULT_MESSAGE', (msg) => {
        const payload = msg.payload as any;
        if (payload.sessionId && payload.sessionId !== sessionId) return;

        const dto = plainToInstance(ResultMessageDto, {
          ...payload,
          sessionId,
        });
        onMessage(dto);
      })
    );

    return () => unsubscribers.forEach((unsub) => unsub());
  }

  /**
   * Create a new session
   * POST /sessions
   */
  async create(): Promise<void> {
    await this.bridge.request('NEW_SESSION', {});
  }

  /**
   * Delete a session
   * DELETE /sessions/:id
   */
  async destroy(sessionId: string): Promise<void> {
    await this.bridge.request('DELETE_SESSION', { sessionId });
  }

  /**
   * Activate (switch to) a session
   * POST /sessions/:id/activate
   */
  async activate(sessionId: string): Promise<void> {
    await this.bridge.request('SESSION_CHANGE', { sessionId });
  }

  /**
   * Subscribe to session loaded events
   */
  onSessionLoaded(
    callback: (data: { sessionId: string; messages: AnyMessageDto[] }) => void
  ): () => void {
    return this.bridge.subscribe('SESSION_LOADED', (message) => {
      const payload = message.payload as unknown as LoadSessionResponse;
      callback({
        sessionId: payload.sessionId,
        messages: transformMessages(payload.messages),
      });
    });
  }
}
