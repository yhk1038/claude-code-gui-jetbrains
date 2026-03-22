import {FC} from "react";
import {ToolUseBlockDto} from "@/dto";
import {LoadedMessageDto} from "@/types";
import { BashRenderer } from "./BashRenderer";
import {TodoWriteRenderer} from "./TodoWriteRenderer.tsx";
import {TaskRenderer} from "./TaskRenderer.tsx";
import {ReadRenderer} from "@/pages/ChatPage/message-renderers/ToolRenderers/ReadRenderer.tsx";
import {GrepRenderer} from "@/pages/ChatPage/message-renderers/ToolRenderers/GrepRenderer.tsx";
import {GlobRenderer} from "@/pages/ChatPage/message-renderers/ToolRenderers/GlobRenderer.tsx";
import {EditRenderer} from "@/pages/ChatPage/message-renderers/ToolRenderers/EditRenderer.tsx";
import {AskUserQuestionRenderer} from "./AskUserQuestion";
import {EnterPlanModeRenderer} from "./EnterPlanModeRenderer.tsx";
import {ExitPlanModeRenderer} from "./ExitPlanModeRenderer.tsx";
import {WebFetchRenderer} from "./WebFetchRenderer.tsx";
import {WebSearchRenderer} from "./WebSearchRenderer.tsx";
import {WriteRenderer} from "./WriteRenderer.tsx";
import {SkillRenderer} from "./SkillRenderer.tsx";
import {ToolSearchRenderer} from "./ToolSearchRenderer.tsx";
import {TaskOutputRenderer} from "./TaskOutputRenderer.tsx";
import {TaskStopRenderer} from "./TaskStopRenderer.tsx";

interface ToolRendererProps {
    toolUse: ToolUseBlockDto;
    toolResult?: LoadedMessageDto;
    message?: LoadedMessageDto;
}

export const ToolRendererMap = new Map<string, FC<ToolRendererProps>>([
    ['Bash', BashRenderer],
    ['TodoWrite', TodoWriteRenderer],
    ['Task', TaskRenderer],
    ['Agent', TaskRenderer],
    ['Read', ReadRenderer],
    ['Grep', GrepRenderer],
    ['Glob', GlobRenderer],
    ['Edit', EditRenderer],
    ['AskUserQuestion', AskUserQuestionRenderer],
    ['EnterPlanMode', EnterPlanModeRenderer],
    ['ExitPlanMode', ExitPlanModeRenderer],
    ['WebFetch', WebFetchRenderer],
    ['WebSearch', WebSearchRenderer],
    ['Write', WriteRenderer],
    ['Skill', SkillRenderer],
    ['ToolSearch', ToolSearchRenderer],
    ['TaskOutput', TaskOutputRenderer],
    ['TaskStop', TaskStopRenderer],
]);
