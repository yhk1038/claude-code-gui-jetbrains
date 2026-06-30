import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readNewBytes, SessionJsonlWatcher } from '../session-jsonl-watcher';

describe('readNewBytes', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-watch-${Date.now()}-${Math.random()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fsPromises.unlink(tempFilePath);
    } catch {
      // ignore
    }
  });

  it('reads new bytes from startOffset', async () => {
    await fsPromises.writeFile(tempFilePath, 'hello world');
    const res = await readNewBytes(tempFilePath, 6);
    expect(res.bytesRead).toBe(5);
    expect(res.data).toBe('world');
  });

  it('handles truncation/file-shrink by resetting startOffset to 0', async () => {
    await fsPromises.writeFile(tempFilePath, 'hello world long text');
    // Shrink file
    await fsPromises.writeFile(tempFilePath, 'short');
    const res = await readNewBytes(tempFilePath, 10);
    expect(res.bytesRead).toBe(5);
    expect(res.data).toBe('short');
  });
});

describe('SessionJsonlWatcher', () => {
  let tempFilePath: string;
  let watcher: SessionJsonlWatcher;
  let appendSpy: any;

  beforeEach(async () => {
    tempFilePath = join(tmpdir(), `test-watcher-class-${Date.now()}.jsonl`);
    await fsPromises.writeFile(tempFilePath, '{"uuid":"1","type":"user","message":"hello"}\n');
    appendSpy = vi.fn();
    watcher = new SessionJsonlWatcher(appendSpy);
  });

  afterEach(async () => {
    watcher.stopAll();
    try {
      await fsPromises.unlink(tempFilePath);
    } catch {
      // ignore
    }
  });

  it('sets byteOffset to current file size on watch startup and reads new appends', async () => {
    await watcher.watch('conn1', 'sess1', tempFilePath);
    
    // Append a new line
    await fsPromises.appendFile(tempFilePath, '{"uuid":"2","type":"assistant","message":"hi"}\n');
    
    // Trigger tailRead manually for synchronous test testing
    await watcher.tailRead('sess1');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith('conn1', 'sess1', [
      { uuid: '2', type: 'assistant', message: 'hi' },
    ]);
  });

  it('handles multiple connections watching same session (refcounting)', async () => {
    const appendSpy2 = vi.fn();
    const watcherMult = new SessionJsonlWatcher((conn, sess, msgs) => {
      if (conn === 'conn1') appendSpy(conn, sess, msgs);
      else appendSpy2(conn, sess, msgs);
    });

    await watcherMult.watch('conn1', 'sess1', tempFilePath);
    await watcherMult.watch('conn2', 'sess1', tempFilePath);

    await fsPromises.appendFile(tempFilePath, '{"uuid":"2","type":"assistant"}\n');
    await watcherMult.tailRead('sess1');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy2).toHaveBeenCalledTimes(1);

    // Unwatch connection 1
    watcherMult.unwatch('conn1', 'sess1');
    await fsPromises.appendFile(tempFilePath, '{"uuid":"3","type":"user"}\n');
    await watcherMult.tailRead('sess1');

    expect(appendSpy).toHaveBeenCalledTimes(1); // still 1
    expect(appendSpy2).toHaveBeenCalledTimes(2); // increased to 2
  });

  it('promoteToOwned immediately stops watching and deletes entry', async () => {
    await watcher.watch('conn1', 'sess1', tempFilePath);
    watcher.promoteToOwned('sess1');

    await fsPromises.appendFile(tempFilePath, '{"uuid":"2","type":"assistant"}\n');
    await watcher.tailRead('sess1'); // should do nothing since entry is deleted

    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('unwatchConnection removes connection from all watched sessions (WebView tab close)', async () => {
    const tempFilePath2 = join(tmpdir(), `test-watcher-multi-${Date.now()}.jsonl`);
    await fsPromises.writeFile(tempFilePath2, '{"uuid":"a"}\n');

    try {
      await watcher.watch('conn1', 'sess1', tempFilePath);
      await watcher.watch('conn1', 'sess2', tempFilePath2);

      // conn1 is watching both sessions — simulate WebView tab close
      watcher.unwatchConnection('conn1');

      await fsPromises.appendFile(tempFilePath, '{"uuid":"2"}\n');
      await fsPromises.appendFile(tempFilePath2, '{"uuid":"b"}\n');
      await watcher.tailRead('sess1');
      await watcher.tailRead('sess2');

      expect(appendSpy).not.toHaveBeenCalled();
    } finally {
      await fsPromises.unlink(tempFilePath2).catch(() => {});
    }
  });

  it('switching sessions: re-watching does not mix history from previous session', async () => {
    const tempFilePath2 = join(tmpdir(), `test-watcher-switch-${Date.now()}.jsonl`);
    await fsPromises.writeFile(tempFilePath2, '{"uuid":"a"}\n');

    try {
      // conn1 loads sess1 first
      await watcher.watch('conn1', 'sess1', tempFilePath);
      // conn1 switches to sess2 — must unwatch previous session first
      watcher.unwatchConnection('conn1');
      await watcher.watch('conn1', 'sess2', tempFilePath2);

      // append to sess1 — conn1 must NOT receive it
      await fsPromises.appendFile(tempFilePath, '{"uuid":"2","type":"user"}\n');
      await watcher.tailRead('sess1');
      expect(appendSpy).not.toHaveBeenCalled();

      // append to sess2 — conn1 MUST receive it
      await fsPromises.appendFile(tempFilePath2, '{"uuid":"b","type":"assistant"}\n');
      await watcher.tailRead('sess2');
      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledWith('conn1', 'sess2', [
        { uuid: 'b', type: 'assistant' },
      ]);
    } finally {
      await fsPromises.unlink(tempFilePath2).catch(() => {});
    }
  });
});
