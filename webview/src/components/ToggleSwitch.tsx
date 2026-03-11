interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'normal';
}

export const ToggleSwitch = (props: Props) => {
  const { checked, onChange, disabled = false, size = 'normal' } = props;

  const isSmall = size === 'small';
  const width = isSmall ? 28 : 36;
  const height = isSmall ? 16 : 20;
  const knobSize = isSmall ? 12 : 16;
  const borderRadius = isSmall ? 8 : 10;
  const knobLeft = checked ? (isSmall ? 14 : 18) : 2;

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
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${borderRadius}px`,
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
          left: `${knobLeft}px`,
          width: `${knobSize}px`,
          height: `${knobSize}px`,
          borderRadius: '50%',
          backgroundColor: 'var(--toggle-knob-color, #ffffff)',
          transition: 'left 0.2s ease',
        }}
      />
    </button>
  );
};
