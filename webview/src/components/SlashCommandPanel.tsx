import React, { useRef, useEffect, useState } from 'react';
import { PanelSection, PanelItem, ToggleItem } from '../types/slashCommandPanel';
import { ToggleSwitch } from './ToggleSwitch';
import { TerminalIcon, LinkIcon } from './icons/PanelIcons';

interface SlashCommandPanelProps {
  sections: PanelSection[];
  selectedSectionIndex: number;
  selectedItemIndex: number;
  onItemClick: (sectionIndex: number, itemIndex: number) => void;
  onItemExecute: (item: PanelItem) => void;
  onClose: () => void;
}

export const SlashCommandPanel: React.FC<SlashCommandPanelProps> = ({
  sections,
  selectedSectionIndex,
  selectedItemIndex,
  onItemClick,
  onItemExecute,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

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
        left: '12px',
        marginBottom: '8px',
        width: 'calc(100% - 24px)',
        maxHeight: 'calc(100vh - 200px)',
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
        <a className="text-zinc-500 underline hover:text-zinc-300" href="https://github.com/anthropics/claude-code/issues" target="_blank">
          Report a problem
        </a>
        <div className="text-zinc-400/80">
          v0.0.0
        </div>
      </div>
    </div>
  );
};

// Section Component
const PanelSectionComponent: React.FC<{
  section: PanelSection;
  sectionIndex: number;
  selectedSectionIndex: number;
  selectedItemIndex: number;
  selectedItemRef: React.RefObject<HTMLDivElement>;
  onItemClick: (sectionIndex: number, itemIndex: number) => void;
  onItemExecute: (item: PanelItem) => void;
}> = ({
  section,
  sectionIndex,
  selectedSectionIndex,
  selectedItemIndex,
  selectedItemRef,
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
        style={{
          padding: '8px 12px 4px',
          fontSize: 'var(--section-header-size, 11px)',
          color: 'var(--section-header-color, #6e7681)',
          fontWeight: 500,
          letterSpacing: '0.5px',
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

// Item Component
const PanelItemComponent = React.forwardRef<HTMLDivElement, {
  item: PanelItem;
  isSelected: boolean;
  onClick: () => void;
  onExecute: () => void;
}>(({ item, isSelected, onClick, onExecute }, ref) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (item.disabled) {
      return;
    }
    onClick();
    if (item.type === 'toggle') {
      const toggleItem = item as ToggleItem;
      toggleItem.onToggle(!toggleItem.toggled);
    } else if (item.type === 'link') {
      window.open((item as any).href, '_blank');
    } else if (item.type === 'info') {
      return;
    } else {
      onExecute();
    }
  };

  const isClickable = item.type !== 'info' && !item.disabled;

  // Check if this item has a right-side terminal icon (for Customize section items)
  const hasRightTerminalIcon = item.icon === 'terminal' && item.type === 'action';

  return (
    <div
      ref={ref}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={item.disabled && isHovered ? '구현 예정' : undefined}
      style={{
        height: 'var(--item-height, 28px)',
        paddingLeft: '8px',
        paddingRight: '8px',
        margin: '0 4px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: item.disabled ? 'not-allowed' : (isClickable ? 'pointer' : 'default'),
        backgroundColor: isSelected || isHovered
          ? 'var(--hover-bg, #ffffff)'
          : 'transparent',
        // boxShadow: isSelected
        //   ? 'inset 2px 0 0 var(--selected-border-color, #0078d4)'
        //   : 'none',
        transition: 'background-color 0.1s ease',
        opacity: item.disabled ? 0.5 : 1,
      }}
    >
      {/* Left side: label (no left icon) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 'var(--item-size, 13px)',
            color: item.textStyle?.color === 'secondary'
              ? 'var(--secondary-text-color, #858585)'
              : 'var(--item-text-color, #cccccc)',
            textDecoration: item.textStyle?.underline ? 'underline' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.label}
        </span>
      </div>

      {/* Right side: secondary label / toggle / icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Secondary label (Model section: current model name) */}
        {item.secondaryLabel && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--secondary-text-color, #858585)',
              whiteSpace: 'nowrap',
            }}
          >
            {item.secondaryLabel}
          </span>
        )}

        {/* Toggle switch */}
        {item.type === 'toggle' && (
          <ToggleSwitch
            checked={(item as ToggleItem).toggled}
            onChange={(value) => (item as ToggleItem).onToggle(value)}
          />
        )}

        {/* Right terminal icon for Customize section items */}
        {hasRightTerminalIcon && (
          <TerminalIcon
            style={{ color: 'var(--secondary-text-color, #858585)', flexShrink: 0 }}
          />
        )}

        {/* Link icon */}
        {item.type === 'link' && (
          <LinkIcon
            style={{ color: 'var(--secondary-text-color, #858585)', flexShrink: 0 }}
          />
        )}
      </div>
    </div>
  );
});

PanelItemComponent.displayName = 'PanelItemComponent';
