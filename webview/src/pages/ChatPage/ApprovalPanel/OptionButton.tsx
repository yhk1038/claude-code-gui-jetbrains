import {useEffect, useRef} from "react";

export interface OptionItem {
    key: string;
    label: string;
}

interface Props {
    option: OptionItem;
    isFocused: boolean;
    onClick: () => void;
    onFocus: () => void;
}

export function OptionButton(props: Props) {
    const {option, isFocused = false, onClick, onFocus} = props;
    const ref = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isFocused) ref.current?.focus();
    }, [isFocused]);

    return (
        <button
            type="button"
            ref={ref}
            onClick={onClick}
            tabIndex={0}
            onFocus={onFocus}
            className={`w-full flex items-center gap-2.5 px-2.5 py-[3.5px] border border-border-strong/20 rounded-[4px] text-start font-bold transition-colors duration-100 select-none outline-none ${
                isFocused
                    ? 'text-text-primary bg-accent-primary-subtle'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
        >
            <span className="text-[1rem] text-text-tertiary">{option.key}</span>
            <span className="text-[1rem]">{option.label}</span>
        </button>
    );
}
