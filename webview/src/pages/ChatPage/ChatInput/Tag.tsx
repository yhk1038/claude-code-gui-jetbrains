import {HTMLProps, ReactNode} from "react";

interface Props extends HTMLProps<HTMLButtonElement> {
    type?: "submit" | "reset" | "button" | undefined;
    className?: string;
    children?: ReactNode;
    onClick?: () => any;
}

export function Tag(props: Props) {
    const {type = 'button', title = '', className = '', children, onClick, disabled, ...res} = props;

    return (
        <button
            type={type}
            className={`
                inline-flex items-center gap-1 px-2 py-[2px] rounded
                text-[0.8461rem] font-medium transition-colors
                ${disabled
                    ? 'text-text-tertiary cursor-default'
                    : 'text-text-secondary cursor-pointer hover:bg-surface-hover'
                }
                ${className}
            `}
            title={title}
            onClick={onClick}
            disabled={disabled}
            {...res}
        >
            {children}
        </button>
    )
}
