import { PanelSection } from '@/types/commandPalette';
import { CommandPaletteCommand, CommandPaletteServices } from './types';
import { SectionDef } from './SectionDef';
import { commandToItem } from './commandToItem';

/**
 * Central registry for command palette sections and commands.
 * Uses registerSection(sectionDef, commands[]) API.
 */
export class CommandPaletteRegistry {
  private sections = new Map<string, SectionDef>();
  private sectionCommands = new Map<string, CommandPaletteCommand[]>();
  private servicesRef: { current: CommandPaletteServices };

  constructor(servicesRef: { current: CommandPaletteServices }) {
    this.servicesRef = servicesRef;
  }

  /** Register a section with its commands */
  registerSection(section: SectionDef, commands: CommandPaletteCommand[]): void {
    this.sections.set(section.id, section);
    // Bind services to SlashCommand instances
    for (const cmd of commands) {
      if ('_bind' in cmd && typeof (cmd as any)._bind === 'function') {
        (cmd as any)._bind(() => this.servicesRef.current);
      }
    }
    this.sectionCommands.set(section.id, commands);
  }

  /**
   * Build renderable PanelSection[] from registered sections and commands.
   */
  buildSections(): PanelSection[] {
    const sortedSections = Array.from(this.sections.values())
      .sort((a, b) => a.order - b.order);

    return sortedSections
      .map((sectionDef) => {
        const commands = this.sectionCommands.get(sectionDef.id) ?? [];
        const sortedCommands = [...commands].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const uniqueCommands = sortedCommands.filter((cmd, index, arr) =>
          arr.findIndex(c => c.id === cmd.id) === index
        );

        return {
          id: sectionDef.id,
          title: sectionDef.title,
          showDividerAbove: sectionDef.showDividerAbove,
          scrollable: sectionDef.scrollable,
          maxHeight: sectionDef.maxHeight,
          items: uniqueCommands.map(commandToItem),
        } as PanelSection;
      })
      .filter((section) => section.items.length > 0 || this.sections.has(section.id));
  }

  /**
   * Get keyboard bindings from commands that implement bindKeyboard.
   */
  getKeyboardBindings(): Array<{ id: string; handler: (e: KeyboardEvent) => boolean; execute: () => Promise<void> }> {
    const allCommands = Array.from(this.sectionCommands.values()).flat();
    return allCommands
      .filter((cmd) => cmd.bindKeyboard !== undefined)
      .map((cmd) => ({
        id: cmd.id,
        handler: (e: KeyboardEvent) => cmd.bindKeyboard!(e),
        execute: () => cmd.execute(),
      }));
  }
}
