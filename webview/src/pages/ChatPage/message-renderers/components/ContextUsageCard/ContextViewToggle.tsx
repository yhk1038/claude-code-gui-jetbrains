import React from 'react';

interface Props {
  /** True when the raw CLI markdown is shown instead of the reconstructed view. */
  rawMode: boolean;
  onChange: (rawMode: boolean) => void;
  label: string;
  tooltip: string;
}

/**
 * A compact switch toggling the card between the reconstructed TUI view and the
 * verbatim CLI markdown. Off = reconstructed (default); On = raw markdown. The
 * adjacent label is state-independent ("Show original response") — the switch
 * position alone communicates the current mode.
 */
export const ContextViewToggle: React.FC<Props> = (props: Props) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.rawMode}
      title={props.tooltip}
      onClick={() => props.onChange(!props.rawMode)}
      className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
    >
      <span className="select-none">{props.label}</span>
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
          props.rawMode ? 'bg-accent-primary' : 'bg-border-default'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
            props.rawMode ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
};
