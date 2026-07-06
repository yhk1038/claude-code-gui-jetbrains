import { ToolUseBlockDto } from "@/dto";
import { Container, LabelValue, RendererProps, ToolHeader, ToolWrapper } from "./common";
import { useTranslation } from "@/i18n";

class TaskUpdateToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        taskId: string;
        status?: 'pending' | 'in_progress' | 'completed' | 'deleted';
        subject?: string;
        description?: string;
        activeForm?: string;
        owner?: string;
        addBlocks?: string[];
        addBlockedBy?: string[];
        metadata?: Record<string, string | number | boolean | null>;
    };
}

export function TaskUpdateRenderer(props: RendererProps) {
    const { t } = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as TaskUpdateToolUseDto;

    const name = toolUse.name;
    const { taskId, status, subject, description, activeForm, owner, addBlocks, addBlockedBy } = toolUse.input ?? {};

    const headerSuffix = status ? `#${taskId} → ${status}` : `#${taskId}`;

    const hasChanges = subject || description || activeForm || owner || addBlocks?.length || addBlockedBy?.length;

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name} inProgress={!props.toolResult} className="mb-2.5">
                <div className="text-text-primary/60">{headerSuffix}</div>
            </ToolHeader>

            {hasChanges && (
                <Container>
                    {status && (
                        <LabelValue label={t('task.update.status')} className="border-b border-border-subtle" maxHeight="max-h-[60px]">
                            {status}
                        </LabelValue>
                    )}
                    {subject && (
                        <LabelValue label={t('task.update.subject')} className="border-b border-border-subtle" maxHeight="max-h-[60px]">
                            {subject}
                        </LabelValue>
                    )}
                    {description && (
                        <LabelValue label={t('task.update.desc')} className="border-b border-border-subtle" maxHeight="max-h-[60px]">
                            {description}
                        </LabelValue>
                    )}
                    {activeForm && (
                        <LabelValue label={t('task.common.form')} className="border-b border-border-subtle" maxHeight="max-h-[60px]">
                            {activeForm}
                        </LabelValue>
                    )}
                    {owner && (
                        <LabelValue label={t('task.update.owner')} className="border-b border-border-subtle" maxHeight="max-h-[60px]">
                            {owner}
                        </LabelValue>
                    )}
                    {addBlocks && addBlocks.length > 0 && (
                        <LabelValue label={t('task.update.blocks')} className="border-b border-border-subtle" maxHeight="max-h-[60px]">
                            {addBlocks.join(', ')}
                        </LabelValue>
                    )}
                    {addBlockedBy && addBlockedBy.length > 0 && (
                        <LabelValue label={t('task.update.blockedBy')} maxHeight="max-h-[60px]">
                            {addBlockedBy.join(', ')}
                        </LabelValue>
                    )}
                </Container>
            )}
        </ToolWrapper>
    );
}
