import { homedir } from 'os';
import { join } from 'path';

/**
 * Resolve the Claude Code CLI data directory.
 *
 * Mirrors the CLI's own resolution: `process.env.CLAUDE_CONFIG_DIR ?? ~/.claude`.
 * When a user points the CLI at a non-default location (e.g. `D:\Claude` on
 * Windows via the CLAUDE_CONFIG_DIR env var), every consumer that reads sessions,
 * projects, or global settings must follow it here too. See issue #117.
 */
export function getClaudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
}
