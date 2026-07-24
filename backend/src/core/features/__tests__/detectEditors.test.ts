import { describe, it, expect } from 'vitest';
import { detectInstalledEditors } from '../detectEditors';

describe('detectInstalledEditors', () => {
  it('resolves to an array of EditorInfo entries with the expected shape', async () => {
    const editors = await detectInstalledEditors();

    expect(Array.isArray(editors)).toBe(true);
    for (const editor of editors) {
      expect(typeof editor.id).toBe('string');
      expect(typeof editor.label).toBe('string');
      expect(typeof editor.isDefault).toBe('boolean');
    }
  });
});
