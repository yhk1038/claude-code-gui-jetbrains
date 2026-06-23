import { describe, it, expect } from 'vitest';
import { buildClaudeArgs } from '../claude-process';

describe('buildClaudeArgs', () => {
  it('includes the core stream-json print-mode flags and the session flag', () => {
    const args = buildClaudeArgs('--session-id', 'sid-1', 'ask_before_edit');
    expect(args).toEqual(
      expect.arrayContaining([
        '-p',
        '--output-format',
        'stream-json',
        '--input-format',
        'stream-json',
        '--permission-prompt-tool',
        'stdio',
      ]),
    );
    // session flag and id appear adjacent
    const i = args.indexOf('--session-id');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(args[i + 1]).toBe('sid-1');
  });

  it('maps inputMode to the matching --permission-mode flag', () => {
    expect(buildClaudeArgs('--resume', 's', 'plan')).toEqual(
      expect.arrayContaining(['--permission-mode', 'plan']),
    );
    expect(buildClaudeArgs('--resume', 's', 'bypass')).toEqual(
      expect.arrayContaining(['--permission-mode', 'bypassPermissions']),
    );
    expect(buildClaudeArgs('--resume', 's', 'auto_edit')).toEqual(
      expect.arrayContaining(['--permission-mode', 'acceptEdits']),
    );
  });

  it('omits --permission-mode for an unknown inputMode', () => {
    expect(buildClaudeArgs('--session-id', 's', 'nonsense')).not.toContain('--permission-mode');
  });

  it('pins an explicitly selected model via --model (adjacent value)', () => {
    const args = buildClaudeArgs('--resume', 's', 'ask_before_edit', 'opus[1m]');
    const i = args.indexOf('--model');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(args[i + 1]).toBe('opus[1m]');
  });

  it('omits --model when no model is given (CLI uses its own default)', () => {
    expect(buildClaudeArgs('--resume', 's', 'ask_before_edit')).not.toContain('--model');
    expect(buildClaudeArgs('--resume', 's', 'ask_before_edit', undefined)).not.toContain('--model');
  });

  it('omits --model for the "default" alias (redundant with the CLI default)', () => {
    expect(buildClaudeArgs('--resume', 's', 'ask_before_edit', 'default')).not.toContain('--model');
  });
});
