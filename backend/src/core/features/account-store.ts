import { readFile, writeFile, rename, unlink, mkdir, chmod, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { StoredAccount } from '../../shared';

/**
 * Persistence for saved Claude accounts (the multi-account registry).
 *
 *   ~/.claude-code-gui/accounts.json        — metadata registry (which accounts
 *                                              exist, which one was last active)
 *   ~/.claude-code-gui/accounts/<id>.json   — per-account credential snapshot
 *                                              (raw OAuth blob + oauthAccount), 0600
 *
 * The credential blob is a live OAuth token; snapshot files are written 0600 and
 * NEVER logged. This module only does file I/O — swapping the *live* credential
 * store lives in `live-credentials.ts`, orchestration in `account-manager.ts`.
 */

/** One account's stored credentials + metadata snapshot (the `<id>.json` file). */
export interface AccountSnapshot {
  /** Raw live-credential blob captured for this account (keychain/JSON content). */
  credentials: string;
  /** The `oauthAccount` object from `.claude.json` at capture time, if any. */
  oauthAccount: Record<string, unknown> | null;
}

/** On-disk registry: saved accounts plus a hint of the last switched-to id. */
export interface AccountsRegistry {
  current: string | null;
  accounts: Record<string, StoredAccount>;
}

// Account ids are filesystem-safe (no colon — illegal on Windows) so they can be
// used directly as snapshot filenames. Validated before any path join to block
// traversal from a tampered registry.
const ACCOUNT_ID_PATTERN = /^acc-[a-f0-9-]+$/;

function baseDir(): string {
  return join(homedir(), '.claude-code-gui');
}
function registryPath(): string {
  return join(baseDir(), 'accounts.json');
}
function snapshotsDir(): string {
  return join(baseDir(), 'accounts');
}
function snapshotPath(id: string): string {
  if (!ACCOUNT_ID_PATTERN.test(id)) {
    throw new Error(`Invalid account id: ${id}`);
  }
  return join(snapshotsDir(), `${id}.json`);
}

/** Generate a fresh filesystem-safe account id. */
export function newAccountId(): string {
  return `acc-${randomUUID()}`;
}

async function writeAtomic0600(target: string, content: string): Promise<void> {
  // NOTE: On Windows, POSIX mode 0o600 is not enforced by the filesystem (NTFS
  // ignores the mode bits). Security on Windows relies entirely on the user's ACL.
  // The CLI shares this same limitation and does not apply any Windows-specific ACL
  // hardening either, so our behaviour matches.
  await mkdir(dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, content, { encoding: 'utf-8', mode: 0o600 });
    await rename(temp, target);
    await chmod(target, 0o600).catch(() => undefined);
  } finally {
    if (existsSync(temp)) await unlink(temp).catch(() => undefined);
  }
}

// ─── Registry ────────────────────────────────────────────────────────────────

/** Read the registry, returning an empty one when absent or unparseable. */
export async function readRegistry(): Promise<AccountsRegistry> {
  const path = registryPath();
  if (!existsSync(path)) return { current: null, accounts: {} };
  try {
    const raw = JSON.parse(await readFile(path, 'utf-8')) as Partial<AccountsRegistry>;
    const accounts = raw.accounts && typeof raw.accounts === 'object' ? raw.accounts : {};
    return {
      current: typeof raw.current === 'string' ? raw.current : null,
      accounts: accounts as Record<string, StoredAccount>,
    };
  } catch {
    return { current: null, accounts: {} };
  }
}

/** Overwrite the registry (0600; it carries no secrets but stays user-private). */
export async function writeRegistry(registry: AccountsRegistry): Promise<void> {
  await writeAtomic0600(registryPath(), JSON.stringify(registry, null, 2) + '\n');
}

/** Insert or update one account's metadata and persist. */
export async function upsertAccount(meta: StoredAccount): Promise<void> {
  const registry = await readRegistry();
  registry.accounts[meta.id] = meta;
  await writeRegistry(registry);
}

/** Set the "current" hint and persist. */
export async function setCurrentAccount(id: string | null): Promise<void> {
  const registry = await readRegistry();
  registry.current = id;
  await writeRegistry(registry);
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

/** Read one account's credential snapshot, or null when absent/unreadable. */
export async function readSnapshot(id: string): Promise<AccountSnapshot | null> {
  const path = snapshotPath(id);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as Partial<AccountSnapshot>;
    if (typeof parsed.credentials !== 'string') return null;
    return {
      credentials: parsed.credentials,
      oauthAccount:
        parsed.oauthAccount && typeof parsed.oauthAccount === 'object'
          ? (parsed.oauthAccount as Record<string, unknown>)
          : null,
    };
  } catch {
    return null;
  }
}

/** Write one account's credential snapshot (0600). */
export async function writeSnapshot(id: string, snapshot: AccountSnapshot): Promise<void> {
  await writeAtomic0600(snapshotPath(id), JSON.stringify(snapshot, null, 2) + '\n');
}

/** Remove an account's metadata entry and its credential snapshot. */
export async function deleteAccountFiles(id: string): Promise<void> {
  const registry = await readRegistry();
  if (registry.accounts[id]) {
    delete registry.accounts[id];
    if (registry.current === id) registry.current = null;
    await writeRegistry(registry);
  }
  await unlink(snapshotPath(id)).catch(() => undefined);
}

/** True when a credential snapshot file exists for the given id. */
export function hasSnapshot(id: string): boolean {
  if (!ACCOUNT_ID_PATTERN.test(id)) return false;
  return existsSync(join(snapshotsDir(), `${id}.json`));
}

/** List snapshot ids actually present on disk (for reconciliation/debugging). */
export async function listSnapshotIds(): Promise<string[]> {
  const dir = snapshotsDir();
  if (!existsSync(dir)) return [];
  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .filter((id) => ACCOUNT_ID_PATTERN.test(id));
  } catch {
    return [];
  }
}
