import { PanelSectionId } from '@/types/commandPalette';
import { i18n } from '@/i18n';
import { SectionDef } from '../../SectionDef';

export class SlashCommandsSection extends SectionDef {
  readonly id = PanelSectionId.SlashCommands;
  readonly order = 3;
  readonly scrollable = false;

  get title(): string {
    return i18n.t('commandPalette:sections.slashCommands');
  }
}
