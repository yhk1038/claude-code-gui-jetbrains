import { describe, it, expect } from 'vitest';
import { FolderAttachment } from '../attachment';

describe('FolderAttachment', () => {
  describe('absolutePath normalization', () => {
    it('preserves a path already ending with forward slash', () => {
      const att = new FolderAttachment({ folderName: 'src', absolutePath: '/home/user/src/' });
      expect(att.absolutePath).toBe('/home/user/src/');
    });

    it('appends forward slash to a unix path with no trailing separator', () => {
      const att = new FolderAttachment({ folderName: 'src', absolutePath: '/home/user/src' });
      expect(att.absolutePath).toBe('/home/user/src/');
    });

    it('preserves a path already ending with backslash (Windows)', () => {
      const att = new FolderAttachment({
        folderName: 'src',
        absolutePath: 'C:\\Users\\proj\\src\\',
      });
      // Must end with the same backslash — no mixed separator added
      expect(att.absolutePath).toBe('C:\\Users\\proj\\src\\');
    });

    it('appends backslash to a Windows path with no trailing separator, no mixed separator', () => {
      const att = new FolderAttachment({
        folderName: 'src',
        absolutePath: 'C:\\Users\\proj\\src',
      });
      // Must not produce C:\Users\proj\src/ (mixed)
      expect(att.absolutePath).not.toMatch(/\\\/$/);
      expect(att.absolutePath).not.toMatch(/\/\\$/);
      // Path should end with a separator (either / or \)
      expect(att.absolutePath).toMatch(/[/\\]$/);
    });

    it('does not produce mixed separators for a Windows path', () => {
      const att = new FolderAttachment({
        folderName: 'src',
        absolutePath: 'C:\\Users\\proj\\src',
      });
      // The result must not be "C:\Users\proj\src/" (backslash body + forward slash tail)
      expect(att.absolutePath).not.toBe('C:\\Users\\proj\\src/');
    });

    it('normalizes a mixed-separator Windows path consistently', () => {
      // Edge case: someone passes an already-mixed path
      const att = new FolderAttachment({
        folderName: 'src',
        absolutePath: 'C:\\Users/proj\\src',
      });
      // Must end with exactly one separator and not append a second one if already present
      expect(att.absolutePath).toMatch(/[/\\]$/);
      // Must not end with two separators
      expect(att.absolutePath).not.toMatch(/[/\\]{2}$/);
    });

    it('stores folderName unchanged', () => {
      const att = new FolderAttachment({
        folderName: 'my-folder',
        absolutePath: '/some/path',
      });
      expect(att.folderName).toBe('my-folder');
    });
  });
});
