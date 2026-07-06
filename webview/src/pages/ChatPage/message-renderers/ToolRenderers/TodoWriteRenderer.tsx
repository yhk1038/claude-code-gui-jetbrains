import {ToolUseBlockDto} from "@/dto";
import {useTranslation} from "@/i18n";
import {ToolHeader, ToolWrapper} from "./common";
import {RendererProps} from "./common";


class TodoWriteToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        todos: {
            content: string;
            status: 'completed' | 'in_progress';
            activeForm: string;
        }[];
    };
}

export function TodoWriteRenderer(props: RendererProps) {
    const {t} = useTranslation('chatTools');
    const toolUse = props.toolUse as unknown as TodoWriteToolUseDto;
    const rawTodos = toolUse.input?.todos;
    const todos = (Array.isArray(rawTodos) ? rawTodos : []).filter(
        (todo): todo is TodoWriteToolUseDto['input']['todos'][number] => todo != null && typeof todo.content === 'string'
    );
    // const toolResult = props.toolResult as BashToolResultDto | undefined;
    //
    // const name = toolUse.name;
    // const description = toolUse.input?.description ?? '';
    // const input = toolUse.input?.command ?? '' as string;
    // const output = toolResult?.message?.content[0].content ?? '' as string;

    return (
        <ToolWrapper message={props.message} onClick={() => console.log(props.toolUse, todos)}>
            <ToolHeader name={t('todoWrite.title')} className="mb-[12px]" />

            <div className="text-[0.9230rem] font-mono flex flex-col gap-[8px]">
                {todos.map((todo, i) => {
                    const isChecked = todo.status === 'completed';

                    return (
                        <div key={`todo-${i}-${todo.content.slice(0, 20)}`}>
                            <div className={`flex items-start gap-2 ${isChecked ? 'opacity-40 line-through' : ''}`}>
                                <div><input type="checkbox" defaultChecked={isChecked} disabled /></div>
                                <div>{todo.content}</div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </ToolWrapper>
    );
}
