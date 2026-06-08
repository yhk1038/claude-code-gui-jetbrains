import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export type JsonlEntry = Record<string, unknown>;

/**
 * Read a JSONL file line-by-line and return parsed entries.
 *
 * Uses a stream rather than `readFile` so multi-megabyte session logs do not
 * stall the event loop or allocate a huge intermediate string + split array
 * (issue #19). Malformed and blank lines are skipped silently to match the
 * legacy Cursor parser behavior.
 */
export async function readJsonlEntries(filePath: string): Promise<JsonlEntry[]> {
  return new Promise<JsonlEntry[]>((resolve, reject) => {
    const stream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    const entries: JsonlEntry[] = [];
    let settled = false;

    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      rl.close();
      stream.destroy();
      if (err) reject(err);
      else resolve(entries);
    };

    stream.on('error', settle);
    rl.on('error', settle);

    rl.on('line', (line) => {
      if (!line.trim()) return;
      try {
        entries.push(JSON.parse(line) as JsonlEntry);
      } catch {
        // Skip malformed lines
      }
    });

    rl.once('close', () => settle());
  });
}
