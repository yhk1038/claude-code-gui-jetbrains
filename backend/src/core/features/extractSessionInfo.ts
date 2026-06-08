import { createReadStream } from 'fs';
import { createInterface } from 'readline';

/**
 * Extract session info from JSONL file (Cursor-compatible)
 *
 * Reads the file line-by-line via stream rather than loading the whole file
 * into memory, so multi-megabyte session logs do not stall the event loop
 * or exhaust heap. See issue #19.
 */

type ContentBlock = { type: string; text?: string; [key: string]: unknown };
type MessageContent = ContentBlock[] | string | null;

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

// Counted toward messageCount + lastTimestamp + (potentially) hasUserOrAssistant.
const COUNTED_TYPES = new Set(['user', 'assistant', 'attachment', 'system', 'progress']);

// First entry of these types decides isSidechain for the whole session
// (Cursor performRefresh semantics).
const SIDECHAIN_GATE_TYPES = new Set(['user', 'assistant', 'attachment', 'system']);

export async function extractSessionInfo(file: string): Promise<SessionInfo> {
  let messageCount = 0;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;
  let firstUserPrompt: string | null = null;
  let firstSummary: string | null = null;
  let hasUserOrAssistant = false;
  let sidechainGateSeen = false;
  let isSidechainFromGate = false;
  let skipSession = false;

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let settled = false;

    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      rl.close();
      stream.destroy();
      if (err) reject(err);
      else resolve();
    };

    stream.on('error', settle);
    rl.on('error', settle);

    rl.on('line', (line) => {
      if (skipSession) return;
      if (!line.trim()) return;

      let entry: Record<string, unknown>;
      try {
        entry = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = (entry.type as string) ?? null;
      const timestamp = (entry.timestamp as string) ?? null;
      const isSidechain = (entry.isSidechain as boolean) ?? false;
      const isMeta = (entry.isMeta as boolean) ?? false;

      if (timestamp && firstTimestamp === null) {
        firstTimestamp = timestamp;
      }

      if (type === 'summary') {
        if (firstSummary === null) {
          const summary = (entry.summary as string) ?? null;
          if (summary) firstSummary = summary;
        }
        return;
      }

      if (!type || !COUNTED_TYPES.has(type)) return;

      messageCount++;
      if (timestamp) lastTimestamp = timestamp;

      if (SIDECHAIN_GATE_TYPES.has(type) && !sidechainGateSeen) {
        sidechainGateSeen = true;
        isSidechainFromGate = isSidechain;
        if (isSidechain) {
          skipSession = true;
          settle();
          return;
        }
      }

      if (type === 'user' || type === 'assistant') {
        hasUserOrAssistant = true;
      }

      if (type === 'user' && !isMeta && firstUserPrompt === null) {
        const messageObj = entry.message as Record<string, unknown> | undefined;
        const content = (messageObj?.content ?? null) as MessageContent;
        const text = extractTextFromContent(content);
        if (text) {
          firstUserPrompt = removeSystemTags(text.replace(/\n/g, ' ').trim());
        }
      }
    });

    rl.once('close', () => settle());
  });

  if (skipSession) {
    return {
      title: 'Sidechain Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true,
    };
  }

  if (!hasUserOrAssistant) {
    return {
      title: 'Empty Session',
      lastTimestamp: null,
      createdAt: firstTimestamp || '',
      messageCount,
      isSidechain: true,
    };
  }

  const title = firstSummary ?? firstUserPrompt ?? 'No title';

  return {
    title,
    lastTimestamp,
    createdAt: firstTimestamp || '',
    messageCount,
    isSidechain: isSidechainFromGate,
  };
}
