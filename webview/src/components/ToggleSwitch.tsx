interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'normal';
  ariaLabel?: string;
}

export const ToggleSwitch = (props: Props) => {
  const { checked, onChange, disabled = false, size = 'normal', ariaLabel } = props;

  const isSmall = size === 'small';
  const trackClass = isSmall ? 'h-4 w-7' : 'h-6 w-11';
  const knobClass = isSmall ? 'h-3 w-3' : 'h-4 w-4';
  // The knob moves via a physical `translate-x` (positive = physical right).
  // Under `dir="rtl"` the flex start edge flips to the right, so the same
  // positive translate would push the knob out of the track. The `rtl:`
  // variants negate the shift so the knob mirrors correctly while keeping the
  // `transition-transform` slide animation.
  const knobOn = isSmall ? 'translate-x-3.5 rtl:-translate-x-3.5' : 'translate-x-6 rtl:-translate-x-6';
  const knobOff = isSmall ? 'translate-x-0.5 rtl:-translate-x-0.5' : 'translate-x-1 rtl:-translate-x-1';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex flex-shrink-0 items-center rounded-full transition-colors ${trackClass} ${
        checked ? 'bg-accent-primary' : 'bg-surface-pressed'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block transform rounded-full bg-surface-base transition-transform ${knobClass} ${
          checked ? knobOn : knobOff
        }`}
      />
    </button>
  );
};
