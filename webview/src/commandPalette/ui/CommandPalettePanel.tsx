import React, { useRef, useEffect, useState } from 'react';
import { PanelSection, PanelItem } from '@/types/commandPalette';
import { useVersionInfo } from '@/hooks/useVersionInfo';
import { useCliConfig } from '@/contexts/CliConfigContext';
import { PanelSectionComponent } from './PanelSectionComponent';

interface CommandPalettePanelProps {
  sections: PanelSection[];
  selectedSectionIndex: number;
  selectedItemIndex: number;
  onItemClick: (sectionIndex: number, itemIndex: number) => void;
  onItemExecute: (item: PanelItem) => void;
  onClose: () => void;
}

export const CommandPalettePanel: React.FC<CommandPalettePanelProps> = ({
  sections,
  selectedSectionIndex,
  selectedItemIndex,
  onItemClick,
  onItemExecute,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const { pluginVersion, cliVersion } = useVersionInfo();
  const { refresh } = useCliConfig();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedSectionIndex, selectedItemIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="slash-command-panel"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '0',
        marginBottom: '12px',
        width: 'calc(100%)',
        maxHeight: '320px',
        backgroundColor: 'var(--panel-bg, #252526)',
        borderRadius: 'var(--panel-radius, 6px)',
        boxShadow: 'var(--panel-shadow, 0 4px 12px rgba(0,0,0,0.3))',
        overflowY: 'auto',
        zIndex: 100,
        border: '1px solid var(--divider-color, #3c3c3c)',
      }}
    >
      {sections.map((section, sectionIndex) => (
        <PanelSectionComponent
          key={section.id}
          section={section}
          sectionIndex={sectionIndex}
          selectedSectionIndex={selectedSectionIndex}
          selectedItemIndex={selectedItemIndex}
          selectedItemRef={selectedItemRef}
          onItemClick={onItemClick}
          onItemExecute={onItemExecute}
        />
      ))}

      <div className="text-[11px] flex items-center justify-between px-3 pt-2 pb-3 -mt-2.5">
        <div className="flex items-center gap-3">
          <a className="text-zinc-500 underline hover:text-zinc-300" href="https://github.com/anthropics/claude-code/issues" target="_blank">
            Report a problem
          </a>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-zinc-500 underline hover:text-zinc-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {refreshing ? 'Reloading…' : 'Reload commands'}
          </button>
        </div>
        <div className="text-zinc-400/80">
          {cliVersion ? `v${pluginVersion} · Claude Code ${cliVersion}` : `v${pluginVersion}`}
        </div>
      </div>
    </div>
  );
};
