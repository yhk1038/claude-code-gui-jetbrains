import { SlashCommand } from '../../types';
import { OPEN_ACCOUNT_USAGE_EVENT } from '../model/AccountUsageItem';

/**
 * Whether an already-trimmed input should trigger the usage modal rather than
 * being sent to the CLI. Matches `/usage` exactly, or `/usage` followed by
 * whitespace and (optionally) more text — e.g. `/usage`, `/usage `,
 * `/usage anything`. A non-space suffix like `/usageX` is a different word and
 * does NOT match. Callers must trim leading/trailing whitespace first, so a
 * message that starts with `/usage` after trimming counts as starting with it.
 */
export function matchesUsageCommand(trimmed: string): boolean {
  return /^\/usage(\s|$)/.test(trimmed);
}

/**
 * Local override for the CLI's `/usage` slash command.
 *
 * Typing `/usage` (or picking it from the palette) should do exactly what the
 * "Account & usage…" model item does — open the usage modal — matching the
 * Cursor extension's behaviour. Left as a CLI passthrough it would instead send
 * `/usage` to the CLI, which is not what users expect (reported issue).
 *
 * Registered in `localCommands`, so it shadows the CLI-provided `/usage` entry
 * (same label) via the dedup filter in CommandPaletteProvider.
 */
export class UsageCommand extends SlashCommand {
  readonly id = 'cmd-usage';
  readonly label = '/usage';
  readonly description = 'Account & usage';

  async execute(): Promise<void> {
    window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_USAGE_EVENT));
  }
}
