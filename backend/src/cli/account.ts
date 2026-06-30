/**
 * `account-cli.mjs` — standalone terminal entrypoint for Claude account switching.
 *
 * Invoked by the bash `ccg account …` command (cli/commands/account/). It reuses
 * the EXACT same account logic the GUI uses (account-manager.ts) — the single
 * source of credential truth — so the terminal and the GUI converge on one
 * implementation (CLAUDE.md: Node is the only backend, no logic duplication).
 *
 * This process is short-lived: it does one operation and exits. It does NOT start
 * the WebSocket server, so it works in a bare terminal with no GUI running. It
 * inherits CLAUDE_CONFIG_DIR from the shell verbatim (never overridden) so it
 * operates on the same live credential slot the user's own `claude` reads.
 *
 * Output contract (machine-readable; the bash wrapper renders all user-facing,
 * localized strings):
 *   - Default: TAB-separated lines on stdout, no secrets ever printed.
 *   - `--json`: the raw AccountsResult / StoredAccount JSON for scripting.
 *   - Errors: a short reason on stderr + a dedicated exit code.
 *
 * Exit codes (mapped to i18n messages in bash):
 *   0 ok · 1 generic · 2 no saved accounts · 3 not found · 4 ambiguous ·
 *   5 no live login to save.
 */
import {
  listAccounts,
  switchToAccount,
  saveCurrentAccount,
  deleteAccount,
} from '../core/features/account-manager';
import { readRegistry } from '../core/features/account-store';
import type { StoredAccount } from '../shared';

const EXIT_OK = 0;
const EXIT_GENERIC = 1;
const EXIT_NO_ACCOUNTS = 2;
const EXIT_NOT_FOUND = 3;
const EXIT_AMBIGUOUS = 4;
const EXIT_NO_LOGIN = 5;

/** A subcommand failure carrying the precise exit code for the bash wrapper. */
class CliError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

function tsv(fields: Array<string | null>): string {
  return fields.map((f) => (f ?? '')).join('\t');
}

/**
 * Resolve a user-supplied token to exactly one saved account. Order: exact id →
 * exact email (ci) → exact displayName (ci) → unique substring on email/name.
 * Throws CliError(2) when nothing is saved, (3) when no match, (4) when ambiguous.
 */
async function resolveAccount(token: string): Promise<StoredAccount> {
  const registry = await readRegistry();
  const accounts = Object.values(registry.accounts);
  if (accounts.length === 0) {
    throw new CliError(EXIT_NO_ACCOUNTS, 'No saved accounts.');
  }

  const lower = token.toLowerCase();
  const byId = accounts.find((a) => a.id === token);
  if (byId) return byId;
  const byEmail = accounts.find((a) => a.emailAddress.toLowerCase() === lower);
  if (byEmail) return byEmail;
  const byName = accounts.find((a) => (a.displayName ?? '').toLowerCase() === lower);
  if (byName) return byName;

  const matches = accounts.filter(
    (a) =>
      a.emailAddress.toLowerCase().includes(lower) ||
      (a.displayName ?? '').toLowerCase().includes(lower),
  );
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new CliError(EXIT_NOT_FOUND, `No saved account matches '${token}'.`);
  }
  // Ambiguous: list candidate emails on stderr so the wrapper can show them.
  const candidates = matches.map((a) => a.emailAddress).join(', ');
  throw new CliError(EXIT_AMBIGUOUS, candidates);
}

function requireToken(args: string[], sub: string): string {
  const token = args.find((a) => !a.startsWith('-'));
  if (!token) {
    throw new CliError(EXIT_GENERIC, `Usage: account ${sub} <id|email|name>`);
  }
  return token;
}

// ─── Subcommands ───────────────────────────────────────────────────────────

async function cmdList(json: boolean): Promise<number> {
  const result = await listAccounts();
  if (json) {
    process.stdout.write(JSON.stringify(result));
    return EXIT_OK;
  }
  if (result.accounts.length === 0) return EXIT_NO_ACCOUNTS;
  for (const a of result.accounts) {
    process.stdout.write(
      tsv([a.active ? '1' : '0', a.emailAddress, a.subscriptionType, a.organizationName, a.id]) + '\n',
    );
  }
  return EXIT_OK;
}

async function cmdCurrent(json: boolean): Promise<number> {
  const result = await listAccounts();
  if (json) {
    process.stdout.write(JSON.stringify({ activeEmail: result.activeEmail }));
    return result.activeEmail ? EXIT_OK : EXIT_NO_ACCOUNTS;
  }
  if (!result.activeEmail) return EXIT_NO_ACCOUNTS;
  const live = result.accounts.find((a) => a.active);
  process.stdout.write(tsv([result.activeEmail, live?.subscriptionType ?? null]) + '\n');
  return EXIT_OK;
}

async function cmdUse(args: string[], json: boolean): Promise<number> {
  const target = await resolveAccount(requireToken(args, 'use'));
  const switched = await switchToAccount(target.id);
  process.stdout.write(json ? JSON.stringify(switched) : switched.emailAddress + '\n');
  return EXIT_OK;
}

async function cmdSave(json: boolean): Promise<number> {
  try {
    const saved = await saveCurrentAccount();
    process.stdout.write(json ? JSON.stringify(saved) : saved.emailAddress + '\n');
    return EXIT_OK;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no logged-in/i.test(msg) || /could not determine/i.test(msg)) {
      throw new CliError(EXIT_NO_LOGIN, msg);
    }
    throw err;
  }
}

async function cmdRm(args: string[], json: boolean): Promise<number> {
  const target = await resolveAccount(requireToken(args, 'rm'));
  await deleteAccount(target.id);
  process.stdout.write(json ? JSON.stringify(target) : target.emailAddress + '\n');
  return EXIT_OK;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  const rest = argv.slice(1);
  const json = rest.includes('--json');
  const positional = rest.filter((a) => a !== '--json');

  switch (sub) {
    case 'list':
      return cmdList(json);
    case 'current':
      return cmdCurrent(json);
    case 'use':
    case 'switch':
      return cmdUse(positional, json);
    case 'save':
      return cmdSave(json);
    case 'rm':
      return cmdRm(positional, json);
    default:
      process.stderr.write(`Unknown subcommand: ${sub ?? '(none)'}\n`);
      return EXIT_GENERIC;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    if (err instanceof CliError) {
      if (err.message) process.stderr.write(err.message + '\n');
      process.exit(err.code);
    }
    process.stderr.write((err instanceof Error ? err.message : String(err)) + '\n');
    process.exit(EXIT_GENERIC);
  });
