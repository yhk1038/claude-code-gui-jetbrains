import { IconType } from '@/types/commandPalette';
import { StaticItem } from '../../types';
import { SessionState } from '@/types';

export const contextItems = [
  new StaticItem('attach-file', 'Attach file...', { icon: IconType.File }),
  new StaticItem('mention-file', 'Mention file from this project...', { icon: IconType.File }),
  new StaticItem('clear-conversation', 'Clear conversation', {
    disabled: false,
    serviceAction: async (services) => {
      if (services.chatStream.isStreaming) services.chatStream.stop();
      services.chatStream.resetForSessionSwitch();
      services.session.setCurrentSessionId(null);
      services.session.setSessionState(SessionState.Idle);
    },
  }),
];
