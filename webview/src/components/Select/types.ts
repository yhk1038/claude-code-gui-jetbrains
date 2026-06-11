export interface SelectOption {
  value: string;
  label: string;
  /** Render the option (and the trigger when selected) in muted italic, e.g. "Not set (use global)". */
  italic?: boolean;
}
