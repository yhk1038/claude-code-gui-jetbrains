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

  // When the text is nothing but system tags (e.g. a slash command like
  // "<command-name>/init</command-name>"), nothing meaningful is left. Return
  // the empty string so the caller can fall through to the next title
  // candidate instead of leaking the raw tags.
  return cleaned;
}

/**
 * Derive a title from a user message's text. A slash command is recorded as
 * "<command-name>/init</command-name>", so we surface "/init" — mirroring the
 * command chip the chat renders (see the webview's parseUserContent) rather than
 * leaking raw tags or the expanded command prompt. Otherwise the text is returned
 * with system tags stripped, or null when nothing meaningful remains so the caller
 * can fall through to the next candidate.
 */
function deriveTitleFromUserText(text: string): string | null {
  const commandMatch = /<command-name>([\s\S]*?)<\/command-name>/.exec(text);
  if (commandMatch) {
    const name = commandMatch[1].trim().replace(/^\/+/, '');
    if (name) return `/${name}`;
  }
  const cleaned = removeSystemTags(text.replace(/\n/g, ' ').trim());
  return cleaned.length > 0 ? cleaned : null;
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

      // Capture the first meaningful prompt from a real (non-meta) user message.
      // A slash command surfaces as its name ("/init"); a normal message uses its
      // text with system tags stripped. Entries that reduce to nothing (a bare
      // system tag, an empty tool_result) are skipped so the scan continues to the
      // next real prompt.
      if (type === 'user' && !isMeta && firstUserPrompt === null) {
        const messageObj = entry.message as Record<string, unknown> | undefined;
        const content = (messageObj?.content ?? null) as MessageContent;
        const text = extractTextFromContent(content);
        if (text) {
          const candidate = deriveTitleFromUserText(text);
          if (candidate) {
            firstUserPrompt = candidate;
          }
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
