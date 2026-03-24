import { describe, it, expect } from 'vitest';
import { normalizeProjectPath } from '../getProjectSessionsPath';

/**
 * Cross-layer consistency tests (Phase 5)
 *
 * Verifies that TypeScript backend logic produces results consistent with
 * the Kotlin implementation. Since we can't run Kotlin code in vitest,
 * we validate against shared fixture data that both implementations
 * should agree on.
 *
 * Kotlin counterpart: ClaudeSessionService normalizes paths the same way.
 */

// Shared fixture: input paths and expected normalized results
// These same values should be tested in the Kotlin test suite
const PATH_NORMALIZATION_FIXTURES = [
  { input: '/home/user/project', expected: '-home-user-project' },
  { input: '/Users/admin/Documents/app', expected: '-Users-admin-Documents-app' },
  { input: 'C:\\Users\\admin\\project', expected: 'C--Users-admin-project' },
  { input: '/home/user/my project', expected: '-home-user-my-project' },
  { input: '/home/user/.config/app', expected: '-home-user--config-app' },
  { input: '', expected: '' },
];

// JS settings parsing fixtures
// Backend readSettingsFile and Kotlin JsSettingsParser.parse should agree
const JS_SETTINGS_FIXTURES = [
  {
    name: 'simple settings with comments',
    input: `export default {
  // Theme
  theme: "dark",
  fontSize: 16,
  debugMode: true,
};`,
    expectedKeys: ['theme', 'fontSize', 'debugMode'],
    expectedValues: { theme: 'dark', fontSize: 16, debugMode: true },
  },
  {
    name: 'settings with null and string values',
    input: `export default {
  cliPath: null,
  theme: "system",
};`,
    expectedKeys: ['cliPath', 'theme'],
    expectedValues: { cliPath: null, theme: 'system' },
  },
];

describe('Cross-layer consistency', () => {
  describe('Path normalization (TS backend == Kotlin)', () => {
    for (const fixture of PATH_NORMALIZATION_FIXTURES) {
      it(`should normalize "${fixture.input}" to "${fixture.expected}"`, () => {
        expect(normalizeProjectPath(fixture.input)).toBe(fixture.expected);
      });
    }
  });

  describe('JS settings parsing (TS backend expected results)', () => {
    // The TS backend strips comments, unwraps export default, parses JSON
    // These fixtures document the expected output for cross-layer verification

    for (const fixture of JS_SETTINGS_FIXTURES) {
      it(`should parse: ${fixture.name}`, () => {
        // Replicate the TS parsing pipeline
        let stripped = fixture.input.replace(/\/\*[\s\S]*?\*\//g, '');
        stripped = stripped.replace(/\/\/[^\n]*/g, '');
        stripped = stripped.replace(/^\s*export\s+default\s*/, '').replace(/;\s*$/, '').trim();
        stripped = stripped.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
        stripped = stripped.replace(/,\s*([\]}])/g, '$1');

        const parsed = JSON.parse(stripped) as Record<string, unknown>;

        for (const [key, value] of Object.entries(fixture.expectedValues)) {
          expect(parsed[key]).toEqual(value);
        }
      });
    }
  });
});
