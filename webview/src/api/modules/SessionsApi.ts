import { BridgeClient } from '../bridge/BridgeClient';
import { SessionMetaDto } from '../../dto';
import { transformMessages } from '../../mappers/messageTransformer';
import { AnyMessageDto } from '../../dto/message/MessageDto';

interface GetSessionsResponse {
  sessions: Array<{
    sessionId: string;
    firstPrompt?: string;
    created: string;
    modified: string;
    messageCount?: number;
    projectPath?: string;
    gitBranch?: string;
  }>;
}

interface LoadSessionResponse {
  sessionId: string;
  messages: unknown[];
}

/**
 * Sessions API module
 * Handles session CRUD operations
 */
export class SessionsApi {
  constructor(private bridge: BridgeClient) {}

  /**
   * Get list of all sessions
   */
  async getList(workingDir?: string): Promise<SessionMetaDto[]> {
    const response = await this.bridge.request<GetSessionsResponse>(
      'GET_SESSIONS',
      { workingDir }
    );

    if (!response?.sessions || !Array.isArray(response.sessions)) {
      return [];
    }

    // Map CLI session format to SessionMetaDto
    return response.sessions.map((s) => {
      const dto = new SessionMetaDto();
      dto.id = s.sessionId;
      dto.title = s.firstPrompt?.substring(0, 50) || 'No title';
      dto.createdAt = s.created;
      dto.updatedAt = s.modified;
      dto.messageCount = s.messageCount || 0;
      dto.projectPath = s.projectPath;
      dto.gitBranch = s.gitBranch;
      return dto;
    });
  }

  /**
   * Load a specific session by ID
   * Returns messages via SESSION_LOADED event subscription
   */
  async load(sessionId: string, workingDir?: string): Promise<void> {
    await this.bridge.request('LOAD_SESSION', { sessionId, workingDir });
    // Messages will be delivered via SESSION_LOADED event
  }

  /**
   * Load session and wait for messages
   */
  async loadWithMessages(
    sessionId: string,
    workingDir?: string
  ): Promise<{ sessionId: string; messages: AnyMessageDto[] }> {
    // Set up listener before sending request
    const messagesPromise = this.bridge.waitFor<LoadSessionResponse>(
      'SESSION_LOADED',
      30000
    );

    // Send load request
    await this.bridge.request('LOAD_SESSION', { sessionId, workingDir });

    // Wait for messages
    const response = await messagesPromise;

    return {
      sessionId: response.sessionId,
      messages: transformMessages(response.messages),
    };
  }

  /**
   * Create a new session
   */
  async create(): Promise<void> {
    await this.bridge.request('NEW_SESSION', {});
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    await this.bridge.request('DELETE_SESSION', { sessionId });
  }

  /**
   * Change current session
   */
  async switchTo(sessionId: string): Promise<void> {
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
