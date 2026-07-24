import { getAdapter } from '@/adapters';
import { Route } from '@/router';

/**
 * Whitelist check for `NAVIGATE` actions: the target must be one of the fixed
 * in-app routes (`Route`/`ROUTE_META` keys in `@/router/routes`). A
 * server-sent route outside this set is never navigated to, no matter what
 * the server instructs — this is the security boundary, not a UX nicety.
 */
export function isAllowedRoute(route: string): route is Route {
  return (Object.values(Route) as string[]).includes(route);
}

/**
 * Explicit whitelist of `RUN_COMMAND` command ids an announcement is allowed
 * to trigger. There is no single existing "run a command by id" registry to
 * reuse here — the command palette (`commandPalette/sections/.../items.ts`)
 * wires each item's action inline, several bound to page-local services
 * (chat stream, session, workflow panel) that aren't available from an
 * announcement card. So this is a small, deliberately curated allow-list of
 * commands that only need adapter-level (IDE-agnostic) calls.
 *
 * Ids intentionally reuse the same string as their command-palette
 * counterpart (`sections/support/items.ts`'s `help-docs`/`restart-plugin`)
 * per this codebase's naming convention: same action, same word, across
 * layers (see CLAUDE.md "일관된 작명 원칙").
 */
export enum AnnouncementCommandId {
  HELP_DOCS = 'help-docs',
  RESTART_PLUGIN = 'restart-plugin',
}

export function isAllowedCommand(command: string): command is AnnouncementCommandId {
  return (Object.values(AnnouncementCommandId) as string[]).includes(command);
}

/**
 * Handlers backing each whitelisted command id. Every handler reuses an
 * existing `IdeAdapter` method — no new bridge behavior is introduced for
 * announcements.
 */
export const ANNOUNCEMENT_COMMAND_HANDLERS: Record<AnnouncementCommandId, () => void | Promise<void>> = {
  [AnnouncementCommandId.HELP_DOCS]: () =>
    getAdapter().openUrl('https://docs.anthropic.com/en/docs/claude-code/overview'),
  [AnnouncementCommandId.RESTART_PLUGIN]: () => getAdapter().restartBackend(),
};
