import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { getProjectSessionsPath } from './getProjectSessionsPath';

// Raw JSONL entry - passed through as-is to match Kotlin backend
type SessionMessage = Record<string, unknown>;

// Parse a JSONL file and return all valid entries
async function parseJsonlFile(filePath: string): Promise<SessionMessage[]> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const entries: SessionMessage[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as SessionMessage);
    } catch {
      // Skip invalid JSON lines
    }
  }
  return entries;
}

// Extract Task tool_use id -> agentId mappings from main session messages
function extractTaskAgentMappings(messages: SessionMessage[]): Map<string, string> {
  // Map from tool_use id (of Task call) -> agentId
  const toolUseToAgentId = new Map<string, string>();

  // First pass: collect all Task tool_use ids from assistant messages
  const taskToolUseIds = new Set<string>();
  for (const msg of messages) {
    if (msg.type !== 'assistant') continue;
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) continue;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as Record<string, unknown>).type === 'tool_use' &&
        (block as Record<string, unknown>).name === 'Task'
      ) {
        const id = (block as Record<string, unknown>).id;
        if (typeof id === 'string') {
          taskToolUseIds.add(id);
        }
      }
    }
  }

  // Second pass: find tool_result messages for those Task tool_use ids and extract agentId
  const agentIdRegex = /agentId:\s*([a-f0-9]+)/;
  for (const msg of messages) {
    if (msg.type !== 'user') continue;
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) continue;
    const content = message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || typeof block !== 'object') continue;
      const b = block as Record<string, unknown>;
      if (b.type !== 'tool_result') continue;
      const toolUseId = b.tool_use_id;
      if (typeof toolUseId !== 'string' || !taskToolUseIds.has(toolUseId)) continue;
      // Extract agentId from the content text
      const resultContent = b.content;
      let text = '';
      if (typeof resultContent === 'string') {
        text = resultContent;
      } else if (Array.isArray(resultContent)) {
        for (const item of resultContent) {
          if (item && typeof item === 'object' && (item as Record<string, unknown>).type === 'text') {
            text += (item as Record<string, unknown>).text ?? '';
          }
        }
      }
      const match = agentIdRegex.exec(text);
      if (match) {
        toolUseToAgentId.set(toolUseId, match[1]);
      }
    }
  }

  return toolUseToAgentId;
}

// Load subagent entries and convert them to synthetic progress entries
async function loadSubagentProgress(
  subagentsDir: string,
  taskToolUseId: string,
  agentId: string,
): Promise<SessionMessage[]> {
  const subagentFile = join(subagentsDir, `agent-${agentId}.jsonl`);
  const subagentEntries = await parseJsonlFile(subagentFile);

  const syntheticEntries: SessionMessage[] = [];
  for (const entry of subagentEntries) {
    const entryType = entry.type;
    if (entryType !== 'assistant' && entryType !== 'user') continue;

    syntheticEntries.push({
      type: 'progress',
      parentToolUseID: taskToolUseId,
      uuid: entry.uuid,
      parentUuid: entry.parentUuid,
      timestamp: entry.timestamp,
      data: {
        type: 'agent_progress',
        agentId,
        message: {
          type: entryType,
          message: entry.message,
          uuid: entry.uuid,
          timestamp: entry.timestamp,
        },
      },
    });
  }

  return syntheticEntries;
}

export async function loadSessionMessages(workingDir: string, targetSessionId: string): Promise<SessionMessage[]> {
  try {
    const sessionsPath = await getProjectSessionsPath(workingDir);
    const sessionFile = join(sessionsPath, `${targetSessionId}.jsonl`);

    const content = await readFile(sessionFile, 'utf-8');
    const lines = content.trim().split('\n');

    const messages: SessionMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line) as SessionMessage;
        // Raw JSONL entry 그대로 전달 (type 필터링 제거)
        messages.push(entry);
      } catch {
        // Skip invalid JSON lines
      }
    }

    // Load subagent files and inject synthetic progress entries
    try {
      const subagentsDir = join(sessionsPath, targetSessionId, 'subagents');

      // Check if subagents directory exists before proceeding
      try {
        await stat(subagentsDir);
      } catch {
        // No subagents directory — return main messages as-is
        return messages;
      }

      // Extract Task tool_use id -> agentId mappings from main messages
      const toolUseToAgentId = extractTaskAgentMappings(messages);

      if (toolUseToAgentId.size === 0) {
        return messages;
      }

      // Build a map from tool_use id -> index of the assistant message containing that Task tool_use
      const toolUseToAssistantIndex = new Map<string, number>();
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.type !== 'assistant') continue;
        const message = msg.message as Record<string, unknown> | undefined;
        if (!message) continue;
        const msgContent = message.content;
        if (!Array.isArray(msgContent)) continue;
        for (const block of msgContent) {
          if (
            block &&
            typeof block === 'object' &&
            (block as Record<string, unknown>).type === 'tool_use' &&
            (block as Record<string, unknown>).name === 'Task'
          ) {
            const id = (block as Record<string, unknown>).id;
            if (typeof id === 'string' && toolUseToAgentId.has(id)) {
              toolUseToAssistantIndex.set(id, i);
            }
          }
        }
      }

      // Load all subagent progress entries, keyed by insertion index
      // We collect (insertAfterIndex, syntheticEntries) pairs, then splice in reverse order
      const insertions: Array<{ afterIndex: number; entries: SessionMessage[] }> = [];

      for (const [toolUseId, agentId] of toolUseToAgentId.entries()) {
        const assistantIndex = toolUseToAssistantIndex.get(toolUseId);
        if (assistantIndex === undefined) continue;

        try {
          const syntheticEntries = await loadSubagentProgress(subagentsDir, toolUseId, agentId);
          if (syntheticEntries.length > 0) {
            insertions.push({ afterIndex: assistantIndex, entries: syntheticEntries });
          }
        } catch {
          // Subagent file missing or unreadable — skip gracefully
        }
      }

      // Insert in reverse order of index so earlier insertions don't shift later indices
      insertions.sort((a, b) => b.afterIndex - a.afterIndex);
      for (const { afterIndex, entries } of insertions) {
        messages.splice(afterIndex + 1, 0, ...entries);
      }
    } catch {
      // Any unexpected error in subagent loading — return main messages as-is
    }

    return messages;
  } catch (err) {
    console.error('[node-backend]', 'Error loading session:', err);
    return [];
  }
}
