import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="toggle-switch"
      style={{
        width: 'var(--toggle-width, 36px)',
        height: 'var(--toggle-height, 20px)',
        borderRadius: 'var(--toggle-border-radius, 10px)',
        backgroundColor: checked
          ? 'var(--toggle-on-bg, #0078d4)'
          : 'var(--toggle-off-bg, #3c3c3c)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '18px' : '2px',
          width: 'var(--toggle-knob-size, 16px)',
          height: 'var(--toggle-knob-size, 16px)',
          borderRadius: '50%',
          backgroundColor: 'var(--toggle-knob-color, #ffffff)',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  );
};
