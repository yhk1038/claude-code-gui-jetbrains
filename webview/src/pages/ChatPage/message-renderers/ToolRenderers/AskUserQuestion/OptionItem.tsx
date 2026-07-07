export function OptionItem(props: {
    label: string;
    description: string;
    selected: boolean;
    multiSelect: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    const { label, description, selected, multiSelect, disabled, onClick } = props;

    const baseClass =
        "px-3 py-2 border rounded cursor-pointer transition-colors select-none";
    const selectedClass = "border-border-focus/50 bg-state-info-bg";
    const unselectedClass = "border-border-subtle bg-surface-hover hover:bg-surface-tooltip/50";
    const disabledClass = "opacity-50 cursor-not-allowed";

    return (
        <div
            className={`${baseClass} ${selected ? selectedClass : unselectedClass} ${disabled ? disabledClass : ""}`}
            onClick={disabled ? undefined : onClick}
        >
            <div className="flex items-center gap-2">
                {multiSelect ? (
                    <div
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                            selected ? "border-border-focus bg-accent-primary-hover" : "border-border-strong"
                        }`}
                    >
                        {selected && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                <path
                                    d="M1 3L3.5 5.5L8 1"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </div>
                ) : (
                    <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            selected ? "border-border-focus" : "border-border-strong"
                        }`}
                    >
                        {selected && (
                            <div className="w-2 h-2 rounded-full bg-accent-primary" />
                        )}
                    </div>
                )}
                <span className="text-text-primary/90 text-[1rem]">{label}</span>
            </div>
            {description && (
                <div className="text-text-primary/50 text-[0.8461rem] mt-0.5 ms-5">{description}</div>
            )}
        </div>
    );
}
