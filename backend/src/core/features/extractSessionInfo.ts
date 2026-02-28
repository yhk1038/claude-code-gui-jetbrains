import { readFile } from 'fs/promises';

/**
 * Extract session info from JSONL file (Cursor-compatible)
 */

type ContentBlock = { type: string; text?: string; [key: string]: unknown };
type MessageContent = ContentBlock[] | string | null;

interface MessageInfo {
  uuid: string;
  parentUuid: string | null;
  type: string;
  isSidechain: boolean;
  timestamp: string | null;
  isMeta: boolean;
  content: MessageContent;
}

export interface SessionInfo {
  title: string;
  lastTimestamp: string | null;
  createdAt: string;
  messageCount: number;
  isSidechain: boolean;
}

function removeSystemTags(text: string): string {
  // Remove XML-style tags and their content
  const tagPattern = /<[^>]+>[^<]*<\/[^>]+>/g;
  let cleaned = text.replace(tagPattern, '');

  // Remove self-closing or unclosed tags
  const singleTagPattern = /<[^>]+>/g;
  cleaned = cleaned.replace(singleTagPattern, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If everything was removed, return original text
  return cleaned.length > 0 ? cleaned : text;
}

function extractTextFromContent(content: MessageContent): string | null {
  if (Array.isArray(content)) {
    const lastTextBlock = content.filter((block) => block.type === 'text').pop();
    return lastTextBlock?.text ?? null;
  } else if (typeof content === 'string') {
    return content;
  }
  return null;
}

function buildTranscript(leaf: MessageInfo, messages: Map<string, MessageInfo>): MessageInfo[] {
  const transcript: MessageInfo[] = [];
  let current: MessageInfo | undefined = leaf;

  while (current) {
    transcript.unshift(current); // Add to front
    current = current.parentUuid ? messages.get(current.parentUuid) : undefined;
  }

  return transcript;
}

export async function extractSessionInfo(file: string): Promise<SessionInfo> {
  const messages = new Map<string, MessageInfo>(); // uuid -> MessageInfo
  const summaries = new Map<string, string>(); // leafUuid -> summary
  let lastUuid: string | null = null;
  let firstTimestamp: string | null = null;
  let messageCount = 0;
  let firstUserPrompt: string | null = null;
  let hasSlug = false;
  let hasFileHistorySnapshot = false;
  let skipSession = false;

  // Step 1: Collect all messages into Map
  const content = await readFile(file, 'utf-8');
  const lines = content.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      messageCount++;

      const uuid = (entry.uuid as string) ?? null;
      const parentUuid = (entry.parentUuid as string) ?? null;
      const type = (entry.type as string) ?? null;
      const timestamp = (entry.timestamp as string) ?? null;
      const isSidechain = (entry.isSidechain as boolean) ?? false;
      const isMeta = (entry.isMeta as boolean) ?? false;

      if (timestamp && firstTimestamp === null) {
        firstTimestamp = timestamp;
      }

      // Cursor performRefresh: check first relevant message for isSidechain
      if (messages.size === 0 && ['user', 'assistant', 'attachment', 'system'].includes(type as string)) {
        if (isSidechain) {
          skipSession = true;
          break;
        }
      }

      // Collect summaries
      if (type === 'summary') {
        const leafUuid = (entry.leafUuid as string) ?? null;
        const summary = (entry.summary as string) ?? null;
        if (leafUuid && summary) {
          summaries.set(leafUuid, summary);
        }
      }

      // Check for slug field
      if (!hasSlug && entry.slug) {
        hasSlug = true;
      }

      // Check for file-history-snapshot type
      if (!hasFileHistorySnapshot && type === 'file-history-snapshot') {
        hasFileHistorySnapshot = true;
      }

      // Add to messages Map (only relevant types)
      if (uuid && type && ['user', 'assistant', 'attachment', 'system', 'progress'].includes(type)) {
        const messageObj = entry.message as Record<string, unknown> | undefined;
        const messageContent = (messageObj?.content ?? null) as MessageContent;

        messages.set(uuid, {
          uuid,
          parentUuid,
          type,
          isSidechain,
          timestamp,
          isMeta,
          content: messageContent,
        });

        lastUuid = uuid;
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Suppress unused variable warning
  void lastUuid;

  if (skipSession) {
    return {
      title: 'Sidechain Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true,
    };
  }

  // Filter out sessions without BOTH slug AND file-history-snapshot (Cursor compatibility)
  if (!hasSlug && !hasFileHistorySnapshot) {
    return {
      title: 'Incomplete Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true, // Treat as sidechain to filter it out
    };
  }

  // Filter out sessions without any user or assistant messages (empty sessions)
  const hasUserOrAssistant = Array.from(messages.values()).some(
    (m) => m.type === 'user' || m.type === 'assistant'
  );
  if (!hasUserOrAssistant) {
    return {
      title: 'Empty Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true, // Treat as sidechain to filter it out
    };
  }

  // Step 2: Find leaf messages (messages that are not parents of other messages)
  const allParentUuids = new Set(Array.from(messages.values()).map((m) => m.parentUuid).filter(Boolean));
  const leafMessages = Array.from(messages.values()).filter((m) => !allParentUuids.has(m.uuid));

  // Step 3: Build transcripts from each leaf
  const transcripts = leafMessages.map((leaf) => buildTranscript(leaf, messages));

  // Step 4: Extract isSidechain from first message of first transcript (Cursor fetchSessions logic)
  const isSidechainFromTranscript = transcripts[0]?.[0]?.isSidechain ?? false;

  // Step 5: Extract first user prompt from first transcript
  for (const transcript of transcripts) {
    for (const msg of transcript) {
      if (msg.type === 'user' && !msg.isMeta && firstUserPrompt === null) {
        const text = extractTextFromContent(msg.content);
        if (text) {
          // Remove system tags from the prompt for cleaner title
          firstUserPrompt = removeSystemTags(text.replace(/\n/g, ' ').trim());
          break;
        }
      }
    }
    if (firstUserPrompt) break;
  }

  // Step 6: Determine title (first summary > firstUserPrompt > fallback)
  const firstSummary = summaries.size > 0 ? Array.from(summaries.values())[0] : null;
  const title = firstSummary ?? firstUserPrompt ?? 'No title';

  // Step 7: Find last timestamp from all messages
  const lastTimestamp = Array.from(messages.values())
    .map((m) => m.timestamp)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  return {
    title,
    lastTimestamp,
    createdAt: firstTimestamp || '',
    messageCount,
    isSidechain: isSidechainFromTranscript,
  };
}
