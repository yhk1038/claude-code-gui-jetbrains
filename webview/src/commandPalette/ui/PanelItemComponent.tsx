import React from 'react';
import { PanelItem, ToggleItem, CommandItem, PanelItemType, IconType } from '@/types/commandPalette';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { TerminalIcon, LinkIcon } from './icons/PaletteIcons';
import { cn } from '@/utils/cn';

interface Props {
  item: PanelItem;
  isSelected: boolean;
  onClick: () => void;
  onExecute: () => void;
}

export const PanelItemComponent = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { item, isSelected, onClick, onExecute } = props;

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
  const title = item.disabled
    ? 'Coming soon'
    : item.type === PanelItemType.Command
      ? (item as CommandItem).description
      : undefined;

  return (
    <div
      ref={ref}
      onClick={handleClick}
      title={title}
      className={cn(
        'group mx-1 flex items-center justify-between rounded px-2 transition-colors duration-100',
        item.disabled
          ? 'cursor-not-allowed opacity-50'
          : isClickable
            ? 'cursor-pointer'
            : 'cursor-default',
        isClickable && 'hover:bg-[var(--surface-selected)]',
        isSelected && 'bg-[var(--surface-selected)]',
      )}
      style={{ height: 'var(--item-height, 28px)' }}
    >
      {/* Left side: label (+ optional suffix, e.g. Effort's "(Extra high)") */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap text-ellipsis transition-colors duration-100',
            isSelected
              ? 'text-[var(--text-on-selected)]'
              : item.textStyle?.color === 'secondary'
                ? 'text-[var(--secondary-text-color)]'
                : 'text-[var(--item-text-color)]',
            isClickable && 'group-hover:text-[var(--text-on-selected)]',
            item.textStyle?.underline && 'underline',
          )}
          style={{ fontSize: 'var(--item-size, 13px)' }}
        >
          {item.label}
        </span>
        {item.labelSuffix && (
          <span
            className="flex-shrink-0 text-[var(--secondary-text-color)]"
            style={{ fontSize: 'var(--item-size, 13px)' }}
          >
            {item.labelSuffix()}
          </span>
        )}
      </div>

      {/* Right side: secondary label / toggle / icon */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {item.valueComponent && item.valueComponent()}

        {item.type === PanelItemType.Toggle && (
          <ToggleSwitch
            checked={(item as ToggleItem).toggled}
            onChange={(value) => (item as ToggleItem).onToggle(value)}
            size="small"
          />
        )}

        {hasRightTerminalIcon && (
          <TerminalIcon className="flex-shrink-0 text-[var(--secondary-text-color)]" />
        )}

        {item.type === PanelItemType.Link && (
          <LinkIcon className="flex-shrink-0 text-[var(--secondary-text-color)]" />
        )}
      </div>
    </div>
  );
});

PanelItemComponent.displayName = 'PanelItemComponent';
