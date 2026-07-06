import { PanelSectionId } from '@/types/commandPalette';
import { i18n } from '@/i18n';
import { SectionDef } from '../../SectionDef';

export class ContextSection extends SectionDef {
  readonly id = PanelSectionId.Context;
  readonly order = 0;
  readonly showDividerAbove = false;

  get title(): string {
    return i18n.t('commandPalette:sections.context');
  }
}
