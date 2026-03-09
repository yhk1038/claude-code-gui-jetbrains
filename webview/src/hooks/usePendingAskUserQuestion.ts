import { useMemo, useState, useCallback, useEffect } from 'react';
import { LoadedMessageDto } from '@/types';
import { LoadedMessageType, ToolUseBlockDto } from '@/dto';
import { getBridgeClient } from '@/api/bridge/BridgeClient';

interface AskUserQuestionOption {
  label: string;
  description: string;
}

interface AskUserQuestionItem {
  question: string;
  header: string;
  options: Array<AskUserQuestionOption>;
  multiSelect: boolean;
}

export interface PendingAskUserQuestion {
  toolUse: ToolUseBlockDto & {
    input: {
      questions: Array<AskUserQuestionItem>;
    };
  };
  message: LoadedMessageDto;
  controlRequestId?: string;
}

export function usePendingAskUserQuestion(
  messages: LoadedMessageDto[],
  isStreaming: boolean
): { pending: PendingAskUserQuestion | null; dismiss: (toolUseId: string) => void } {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // control_request의 request_id를 tool_use_id로 매핑 (state로 관리하여 useMemo 재실행 보장)
  const [controlRequestIds, setControlRequestIds] = useState<Map<string, string>>(new Map());

  // CLI_EVENT에서 control_request 이벤트 구독
  useEffect(() => {
    const bridge = getBridgeClient();
    const unsubscribe = bridge.subscribe('CLI_EVENT', (message) => {
      const cliEvent = message.payload as any;
      if (cliEvent?.type !== 'control_request') return;

      const request = cliEvent?.request;
      if (request?.subtype === 'can_use_tool' && request?.tool_name === 'AskUserQuestion') {
        const toolUseId = request.tool_use_id as string;
        const requestId = cliEvent.request_id as string;
        if (toolUseId && requestId) {
          setControlRequestIds(prev => new Map(prev).set(toolUseId, requestId));
        }
      }
    });
    return unsubscribe;
  }, []);

  const pending = useMemo(() => {
    // Collect all tool_result IDs (these are answered)
    const answeredToolIds = new Set<string>();
    for (const msg of messages) {
      if (msg.type === LoadedMessageType.User && Array.isArray(msg.message?.content)) {
        for (const block of (msg.message.content as any[])) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            answeredToolIds.add(block.tool_use_id);
          }
        }
      }
    }

    // Find the last AskUserQuestion tool_use
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.type === LoadedMessageType.Assistant &&
        Array.isArray(msg.message?.content)
      ) {
        for (const block of (msg.message.content as any[])) {
          if (
            block.type === 'tool_use' &&
            block.name === 'AskUserQuestion' &&
            !answeredToolIds.has(block.id) &&
            !dismissedIds.has(block.id) &&
            // Validate questions are fully formed
            Array.isArray(block.input?.questions) &&
            block.input.questions.length > 0 &&
            typeof block.input.questions[0].question === 'string'
          ) {
            const controlRequestId = controlRequestIds.get(block.id);
            // control_request가 도착했으면 스트리밍 상태와 무관하게 패널 표시
            // control_request가 없으면 스트리밍 완료 후에만 표시 (fallback)
            if (controlRequestId || (!isStreaming && !msg.isStreaming)) {
              return {
                toolUse: block,
                message: msg,
                controlRequestId,
              } as PendingAskUserQuestion;
            }
          }
        }
      }
    }

    return null;
  }, [messages, isStreaming, dismissedIds, controlRequestIds]);

  const dismiss = useCallback((toolUseId: string) => {
    setDismissedIds(prev => new Set(prev).add(toolUseId));
    setControlRequestIds(prev => {
      const next = new Map(prev);
      next.delete(toolUseId);
      return next;
    });
  }, []);

  return { pending, dismiss };
}
