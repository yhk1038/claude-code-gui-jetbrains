import {ReactNode} from "react";
import {Tooltip} from "@/components";
import {cn} from "@/utils/cn";

interface Props {
    children?: ReactNode;
    tone?: 'default' | 'success' | 'error' | 'warning';
    title?: string;
}

/** Small pill matching the native DiffCard badge style. */
export const Badge = (props: Props) => {
    const {children, tone = 'default', title} = props;
    const toneCls =
        tone === 'success' ? 'bg-state-success-bg text-state-success-fg'
        : tone === 'error' ? 'bg-state-error-bg text-state-error-fg'
        : tone === 'warning' ? 'bg-state-warning-bg text-state-warning-fg'
        : 'bg-surface-hover text-text-tertiary';
    const badge = <span className={cn("px-2 py-0.5 text-xs rounded shrink-0", title && "cursor-help", toneCls)}>{children}</span>;
    return title ? <Tooltip content={title}>{badge}</Tooltip> : badge;
};
