import { PanelSectionId } from '@/types/commandPalette';
import { i18n } from '@/i18n';
import { SectionDef } from '../../SectionDef';

export class SupportSection extends SectionDef {
  readonly id = PanelSectionId.Support;
  readonly order = 5;

  get title(): string {
    return i18n.t('commandPalette:sections.support');
  }
}
