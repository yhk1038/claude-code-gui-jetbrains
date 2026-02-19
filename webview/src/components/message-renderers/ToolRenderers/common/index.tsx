import {ReactNode, useState} from "react";

export * from './RendererProps';

export const ToolWrapper = (props: {
    onClick?: () => any;
    children: ReactNode;
}) => {
    const {onClick, children} = props;

    return (
        <div className="mt-0.5 mb-1.5" onClick={onClick}>
            {children}
        </div>
    )
}

export const ToolHeader = (props: {
    name: string;
    description?: string;
    inProgress?: boolean;
    children?: ReactNode;
}) => {
    const {name, description = '', inProgress = false, children} = props;

    return (
        <div className="flex items-start gap-1.5 text-[13px] mb-3">
            <div className="text-white text-[13px] font-semibold">
                <span className="">{name}</span>
                {inProgress && (
                    <span className="text-white/50 animate-pulse">...</span>
                )}
            </div>

            {children || <div className="text-white/60">{description}</div>}
        </div>
    )
}

export const Container = ({children}: { children?: ReactNode }) => {
    return (
        <div className="bg-zinc-800/40 border border-white/15 rounded text-[12px] font-mono">
            {children}
        </div>
    )
}

export const LabelValue = (props: {
    label: string;
    className?: string;
    maxHeight?: string;
    children?: ReactNode;
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const {label, children, className = '', maxHeight} = props;

    return (
        <div className={`flex items-start p-2 ${className}`}>
            <Label name={label}/>
            <Value
                isFocused={isFocused}
                onClick={() => setIsFocused((v) => !v)}
                maxHeight={maxHeight}
            >{children}</Value>
        </div>
    )
}

export const Label = ({name}: { name: string }) => {
    return <div className="text-white/40 min-w-[40px]">{name}</div>
}

export const Value = (props: {
    isFocused?: boolean;
    onClick?: () => any;
    maxHeight?: string;
    children?: ReactNode;
}) => {
    const {isFocused, onClick, children, maxHeight = 'max-h-[105px]'} = props;

    return (
        <div className={`flex-1 text-white/80 whitespace-pre font-mono overflow-hidden cursor-pointer ${isFocused ? '' : maxHeight}`} onClick={onClick}>
            {children}
        </div>
    );
}
