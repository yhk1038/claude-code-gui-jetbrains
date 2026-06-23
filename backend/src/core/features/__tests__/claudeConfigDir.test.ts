import { describe, it, expect, afterEach } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import { getClaudeConfigDir } from '../claudeConfigDir';

describe('getClaudeConfigDir', () => {
  const original = process.env.CLAUDE_CONFIG_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = original;
  });

  it('defaults to ~/.claude when CLAUDE_CONFIG_DIR is unset', () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    expect(getClaudeConfigDir()).toBe(join(homedir(), '.claude'));
  });

  it('returns CLAUDE_CONFIG_DIR when set to a custom location', () => {
    process.env.CLAUDE_CONFIG_DIR = join('D:', 'Claude');
    expect(getClaudeConfigDir()).toBe(join('D:', 'Claude'));
  });
});
