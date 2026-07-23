import { describe, it, expect } from 'vitest';
import { assertFileOpened, type OpenFileError } from '../openFileResult';

describe('assertFileOpened', () => {
  it('passes when the ack reports ok:true', () => {
    expect(() => assertFileOpened({ ok: true }, '/abs/x.ts')).not.toThrow();
  });

  it('passes when the ack has no ok field (legacy ack)', () => {
    expect(() => assertFileOpened({}, '/abs/x.ts')).not.toThrow();
    expect(() => assertFileOpened(undefined, '/abs/x.ts')).not.toThrow();
  });

  it('throws with the path and reason when ok:false', () => {
    try {
      assertFileOpened({ ok: false, reason: 'not-found' }, '/abs/x.ts');
      expect.unreachable('should have thrown');
    } catch (e) {
      const err = e as OpenFileError;
      expect(err.filePath).toBe('/abs/x.ts');
      expect(err.reason).toBe('not-found');
      expect(err.message).toContain('/abs/x.ts');
    }
  });

  it('defaults the reason to open-failed when omitted', () => {
    try {
      assertFileOpened({ ok: false }, '/abs/x.ts');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as OpenFileError).reason).toBe('open-failed');
    }
  });
});
