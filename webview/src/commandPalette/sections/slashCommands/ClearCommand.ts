import { SlashCommand } from '../../types';
import { i18n } from '@/i18n';

export class ClearCommand extends SlashCommand {
  readonly id = 'cmd-clear';
  readonly label = '/clear';

  get description(): string {
    return i18n.t('commandPalette:slashCommands.clearDescription');
  }

  async execute(): Promise<void> {
    const services = this.getServices();

    if (services.chatStream.isStreaming) services.chatStream.stop();
    services.chatStream.resetForSessionSwitch();
    services.session.resetToNewSession();
  }

  bindKeyboard(e: KeyboardEvent): boolean {
    return (e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C';
  }
}
