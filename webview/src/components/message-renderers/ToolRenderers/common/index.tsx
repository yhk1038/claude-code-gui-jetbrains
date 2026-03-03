import {ReactNode, useState} from "react";
import {ContextPills} from "@/components/message-renderers";
import type {LoadedMessageDto} from "@/types";
import {cn} from "@/utils/cn.ts";

export * from './RendererProps';

export const ToolWrapper = (props: {
    message?: LoadedMessageDto;
    onClick?: () => any;
    groupClassName?: string;
    className?: string;
    children?: ReactNode;
}) => {
    const {message, groupClassName = '', className = '', onClick, children} = props;

    return (
        <div className={cn(`group pt-2 pb-4 pl-6 pr-3`, groupClassName)}>
            <div className="flex items-start gap-3">
                {/* Bullet indicator */}
                <span className="text-zinc-500 mt-[3px] text-[9px]">●</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className={cn(`mt-0.5`, className)} onClick={onClick}>
                        {children}
                    </div>
                </div>

                {message?.context && <ContextPills context={message.context} />}
            </div>
        </div>
    )
}

export const ToolWrapper2 = (props: {
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
    className?: string;
    children?: ReactNode;
}) => {
    const {name, description = '', className = '', children} = props;

    return (
        <div className={cn(`flex items-start gap-1.5 text-[13px]`, className)}>
            <div className="text-white text-[13px] font-semibold">
                <span className="">{name}</span>
            </div>

            {children || <div className="text-white/60">{description}</div>}
        </div>
    )
}

export const Container = ({children}: { children?: ReactNode }) => {
    return (
        <div className="bg-zinc-800/40 border border-white/15 rounded text-[11px] font-mono">
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
