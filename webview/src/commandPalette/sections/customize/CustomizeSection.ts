import { PanelSectionId } from '@/types/commandPalette';
import { i18n } from '@/i18n';
import { SectionDef } from '../../SectionDef';

export class CustomizeSection extends SectionDef {
  readonly id = PanelSectionId.Customize;
  readonly order = 2;

  get title(): string {
    return i18n.t('commandPalette:sections.customize');
  }
}
