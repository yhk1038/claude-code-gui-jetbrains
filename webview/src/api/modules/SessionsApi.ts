import { plainToInstance } from 'class-transformer';
import { BridgeClient } from '../bridge/BridgeClient';
import { SessionMetaDto } from '../../dto';
import type { ApiConfig } from '../ClaudeCodeApi';

interface GetSessionsResponse {
  sessions: {
    sessionId: string;
    title: string;
    createdAt: string;
    lastTimestamp: string | null;
    messageCount: number;
    isSidechain: boolean;
    projectPath?: string;
    gitBranch?: string;
  }[];
}

/**
 * Sessions API module
 * RESTful CRUD operations for sessions
 *
 * Session is the parent resource of messages (1:N relationship)
 */
export class SessionsApi {

  constructor(
    private bridge: BridgeClient,
    private getConfig: () => ApiConfig
  ) {}

  /**
   * List all sessions
   * GET /sessions
   */
  async index(workingDir?: string): Promise<SessionMetaDto[]> {
    const dir = workingDir ?? this.getConfig().workingDir;
    const response = await this.bridge.request<GetSessionsResponse>(
      'GET_SESSIONS',
      { workingDir: dir }
    );

    if (!response?.sessions || !Array.isArray(response.sessions)) {
      return [];
    }

    return plainToInstance(SessionMetaDto, response.sessions);
  }

  /**
   * Load a session's messages
   * Triggers SESSION_LOADED event which AppProviders.SessionLoader handles
   * POST /sessions/:id/load
   */
  async load(sessionId: string, workingDir?: string): Promise<void> {
    const dir = workingDir ?? this.getConfig().workingDir;
    await this.bridge.request('LOAD_SESSION', { sessionId, workingDir: dir });
  }

  /**
   * Create a new session
   * POST /sessions
   */
  async create(): Promise<void> {
    await this.bridge.request('CREATE_SESSION', {});
  }

  /**
   * Delete a session
   * DELETE /sessions/:id
   */
  async destroy(sessionId: string, workingDir?: string): Promise<void> {
    const dir = workingDir ?? this.getConfig().workingDir;
    await this.bridge.request('DELETE_SESSION', { sessionId, workingDir: dir });
  }

  /**
   * Activate (switch to) a session
   * POST /sessions/:id/activate
   */
  async activate(sessionId: string): Promise<void> {
    await this.bridge.request('SESSION_CHANGE', { sessionId });
  }

  /**
   * Reclaim a session that is already in use by another process
   * Kills the existing process and reloads session messages
   * POST /sessions/:id/reclaim
   */
  async reclaim(sessionId: string, workingDir?: string): Promise<void> {
    const dir = workingDir ?? this.getConfig().workingDir;
    await this.bridge.request('RECLAIM_SESSION', { sessionId, workingDir: dir });
  }
}
