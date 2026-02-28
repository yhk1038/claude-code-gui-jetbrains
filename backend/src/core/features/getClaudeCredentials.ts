import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

interface ClaudeCredentials {
  accessToken: string;
  authMethod: string;
}

function detectAuthMethod(parsed: Record<string, unknown>): string {
  if ('claudeAiOauth' in parsed) return 'Claude AI';
  if ('githubOauth' in parsed) return 'GitHub';
  if ('googleOauth' in parsed) return 'Google';
  return 'Claude AI';
}

async function readRawCredentials(): Promise<Record<string, unknown> | null> {
  if (platform() === 'darwin') {
    try {
      const raw = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w',
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const credPath = join(homedir(), '.claude', '.credentials.json');
  if (!existsSync(credPath)) return null;
  try {
    const raw = await readFile(credPath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read Claude Code OAuth access token from system credentials.
 * macOS: Keychain, Linux: ~/.claude/.credentials.json
 */
export async function getClaudeAccessToken(): Promise<string | null> {
  const parsed = await readRawCredentials();
  if (!parsed) return null;
  const oauth = (parsed.claudeAiOauth ?? parsed.githubOauth ?? parsed.googleOauth) as Record<string, string> | undefined;
  return oauth?.accessToken ?? null;
}

/**
 * Read Claude Code credentials including auth method.
 */
export async function getClaudeCredentials(): Promise<ClaudeCredentials | null> {
  const parsed = await readRawCredentials();
  if (!parsed) return null;
  const authMethod = detectAuthMethod(parsed);
  const oauth = (parsed.claudeAiOauth ?? parsed.githubOauth ?? parsed.googleOauth) as Record<string, string> | undefined;
  const accessToken = oauth?.accessToken;
  if (!accessToken) return null;
  return { accessToken, authMethod };
}
