import { PanelSectionId } from '@/types/commandPalette';
import { i18n } from '@/i18n';
import { SectionDef } from '../../SectionDef';

export class ModelSection extends SectionDef {
  readonly id = PanelSectionId.Model;
  readonly order = 1;

  get title(): string {
    return i18n.t('commandPalette:sections.model');
  }
}
