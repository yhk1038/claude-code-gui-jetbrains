import { PanelSectionId } from '@/types/commandPalette';
import { i18n } from '@/i18n';
import { SectionDef } from '../../SectionDef';

export class SettingsSection extends SectionDef {
  readonly id = PanelSectionId.Settings;
  readonly order = 4;

  get title(): string {
    return i18n.t('commandPalette:sections.settings');
  }
}
