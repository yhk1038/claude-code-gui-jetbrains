import { IconType } from '@/types/commandPalette';
import { StaticItem } from '../../types';

/**
 * Fired when the user runs `/resume`. The session dropdown opens (browse/resume
 * past conversations) and the composer clears the `/resume` text. Issue #28.
 */
export const OPEN_SESSION_DROPDOWN_EVENT = 'command-palette:open-session-dropdown';

export const contextItems = [
  new StaticItem('attach-file', 'Attach file...', {
    icon: IconType.File,
    disabled: false,
    action: async () => {
      window.dispatchEvent(new CustomEvent('command-palette:attach-files'));
    },
  }),
  new StaticItem('mention-file', 'Mention file from this project...', {
    icon: IconType.File,
    disabled: false,
    action: async () => {
      window.dispatchEvent(new CustomEvent('command-palette:mention-file'));
    },
  }),
  new StaticItem('clear-conversation', 'Clear conversation', {
    disabled: false,
    serviceAction: async (services) => {
      if (services.chatStream.isStreaming) services.chatStream.stop();
      services.chatStream.resetForSessionSwitch();
      services.session.resetToNewSession();
    },
  }),
  // Search-only: surfaces when the user types `/resume`. Opens the session
  // dropdown so past conversations can be browsed and resumed (issue #28).
  new StaticItem('resume-conversation', 'Resume conversation', {
    disabled: false,
    searchOnly: true,
    action: async () => {
      window.dispatchEvent(new CustomEvent(OPEN_SESSION_DROPDOWN_EVENT));
    },
  }),
];
