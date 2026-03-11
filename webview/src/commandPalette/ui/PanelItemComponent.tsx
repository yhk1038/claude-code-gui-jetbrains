import React, { useState } from 'react';
import { PanelItem, ToggleItem, PanelItemType, IconType } from '@/types/commandPalette';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { TerminalIcon, LinkIcon } from './icons/PaletteIcons';

export const PanelItemComponent = React.forwardRef<HTMLDivElement, {
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
    if (item.type === PanelItemType.Toggle) {
      const toggleItem = item as ToggleItem;
      toggleItem.onToggle(!toggleItem.toggled);
    } else if (item.type === PanelItemType.Link) {
      window.open((item as any).href, '_blank');
    } else if (item.type === PanelItemType.Info) {
      return;
    } else {
      onExecute();
    }
  };

  const isClickable = item.type !== PanelItemType.Info && !item.disabled;

  const hasRightTerminalIcon = item.icon === IconType.Terminal && item.type === PanelItemType.Action;

  return (
    <div
      ref={ref}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={item.disabled && isHovered ? 'Coming soon' : undefined}
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
        transition: 'background-color 0.1s ease',
        opacity: item.disabled ? 0.5 : 1,
      }}
    >
      {/* Left side: label */}
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
        {item.valueComponent && item.valueComponent()}

        {item.type === PanelItemType.Toggle && (
          <ToggleSwitch
            checked={(item as ToggleItem).toggled}
            onChange={(value) => (item as ToggleItem).onToggle(value)}
            size="small"
          />
        )}

        {hasRightTerminalIcon && (
          <TerminalIcon
            style={{ color: 'var(--secondary-text-color, #858585)', flexShrink: 0 }}
          />
        )}

        {item.type === PanelItemType.Link && (
          <LinkIcon
            style={{ color: 'var(--secondary-text-color, #858585)', flexShrink: 0 }}
          />
        )}
      </div>
    </div>
  );
});

PanelItemComponent.displayName = 'PanelItemComponent';
