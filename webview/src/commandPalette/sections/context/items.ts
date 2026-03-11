import { IconType } from '@/types/commandPalette';
import { StaticItem } from '../../types';

export const contextItems = [
  new StaticItem('attach-file', 'Attach file...', {
    icon: IconType.File,
    disabled: false,
    action: async () => {
      window.dispatchEvent(new CustomEvent('command-palette:attach-files'));
    },
  }),
  new StaticItem('mention-file', 'Mention file from this project...', { icon: IconType.File }),
  new StaticItem('clear-conversation', 'Clear conversation', {
    disabled: false,
    serviceAction: async (services) => {
      if (services.chatStream.isStreaming) services.chatStream.stop();
      services.chatStream.resetForSessionSwitch();
      services.session.resetToNewSession();
    },
  }),
];
