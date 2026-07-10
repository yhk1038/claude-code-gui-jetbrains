import React from 'react';
import { PanelSection, PanelItem } from '@/types/commandPalette';
import { PanelItemComponent } from './PanelItemComponent';

export const PanelSectionComponent: React.FC<{
  section: PanelSection;
  sectionIndex: number;
  selectedSectionIndex: number;
  selectedItemIndex: number;
  selectedItemRef: React.RefObject<HTMLDivElement>;
  query?: string;
  onItemClick: (sectionIndex: number, itemIndex: number) => void;
  onItemExecute: (item: PanelItem) => void;
}> = ({
  section,
  sectionIndex,
  selectedSectionIndex,
  selectedItemIndex,
  selectedItemRef,
  query,
  onItemClick,
  onItemExecute,
}) => {
  const sectionStyle: React.CSSProperties = section.scrollable
    ? { maxHeight: section.maxHeight ?? 200, overflowY: 'auto' }
    : {};

  return (
    <div className="pb-1.5">
      {/* Section Divider */}
      {section.showDividerAbove && (
        <div
          style={{
            height: '1px',
            backgroundColor: 'var(--divider-color, #3c3c3c)',
          }}
        />
      )}

      {/* Section Header */}
      <div
        onClick={section.onHeaderClick}
        style={{
          padding: '8px 12px 4px',
          fontSize: 'var(--section-header-size, 11px)',
          color: 'var(--section-header-color, #6e7681)',
          fontWeight: 500,
          letterSpacing: '0.5px',
          cursor: section.onHeaderClick ? 'pointer' : undefined,
        }}
      >
        {section.title}
      </div>

      {/* Section Items */}
      <div style={sectionStyle}>
        {section.items.map((item, itemIndex) => {
          const isSelected =
            sectionIndex === selectedSectionIndex &&
            itemIndex === selectedItemIndex;

          return (
            <PanelItemComponent
              key={item.id}
              item={item}
              isSelected={isSelected}
              query={query}
              ref={isSelected ? selectedItemRef : null}
              onClick={() => onItemClick(sectionIndex, itemIndex)}
              onExecute={() => onItemExecute(item)}
            />
          );
        })}
      </div>
    </div>
  );
};
