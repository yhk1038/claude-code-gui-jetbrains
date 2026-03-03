import { SlashCommand } from '../../types';
import { SessionState } from '@/types';

export class ClearCommand extends SlashCommand {
  readonly id = 'cmd-clear';
  readonly label = '/clear';
  readonly description = 'Clear conversation';

  async execute(): Promise<void> {
    const { chatStream, session } = this.getServices();

    if (chatStream.isStreaming) {
      chatStream.stop();
    }

    chatStream.resetForSessionSwitch();

    session.setCurrentSessionId(null);
    session.setSessionState(SessionState.Idle);
  }

  bindKeyboard(e: KeyboardEvent): boolean {
    return (e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C';
  }
}
