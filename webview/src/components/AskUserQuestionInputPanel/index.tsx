import { useEffect, useRef, KeyboardEvent } from 'react';
import { PendingAskUserQuestion } from '@/hooks/usePendingAskUserQuestion';
import { useApi } from '@/contexts/ApiContext';
import { useChatStreamContext } from '@/contexts/ChatStreamContext';
import { useFormState } from './useFormState';
import { TabBar } from './TabBar';
import { OptionList } from './OptionList';
import { Footer } from './Footer';

interface Props {
  toolUse: PendingAskUserQuestion['toolUse'];
  controlRequestId?: string;
  onDismiss: () => void;
}

export const AskUserQuestionInputPanel = (props: Props) => {
  const { toolUse, controlRequestId, onDismiss } = props;
  const api = useApi();
  const { stop } = useChatStreamContext();
  const panelRef = useRef<HTMLDivElement>(null);

  const questions = toolUse.input.questions;

  const form = useFormState(questions);

  const questionText = form.currentQuestion.header
    ? form.currentQuestion.question
    : undefined;

  // Esc: deny (capture phase)
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (controlRequestId) {
          api.tools.deny(toolUse.id, controlRequestId);
        }
        stop();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [toolUse.id, controlRequestId, api, onDismiss, stop]);

  // Auto-focus panel on mount
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const result = form.submitCurrent();
    if (result !== null) {
      if (controlRequestId) {
        // control_request가 수신된 경우: control_response로 응답
        api.tools.respond(toolUse.id, result, {
          controlRequestId,
          updatedInput: {
            questions: toolUse.input.questions,
            answers: form.buildAnswersRecord(),
          },
        });
      } else {
        // control_request 미수신 (fallback): 기존 tool_result 방식
        api.tools.respond(toolUse.id, result);
      }
      onDismiss();
    }
  };

  const handleOtherKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="max-w-[44rem] mx-auto px-4 pb-[14px] pt-2">
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative rounded-lg border bg-[#1e1e21] border-zinc-700 outline-none"
      >
        {/* Tab bar */}
        <div className="px-3 pt-2">
          <TabBar
            questions={questions}
            currentIndex={form.currentIndex}
            onTabClick={form.setCurrentIndex}
          />
          {questionText && (
            <div className="mt-4">
              <p className="text-zinc-200 text-[13px]">{questionText}</p>
            </div>
          )}
        </div>

        {/* Options */}
        <OptionList
          options={form.allOptionsFor(form.currentIndex)}
          selected={form.currentField?.selected ?? []}
          multiSelect={form.currentQuestion.multiSelect}
          isOtherSelected={form.isOtherSelected(form.currentIndex)}
          otherText={form.currentField?.otherText ?? ''}
          onSelect={(label) => form.selectOption(form.currentIndex, label, form.currentQuestion.multiSelect)}
          onOtherTextChange={(text) => form.setOtherText(form.currentIndex, text)}
          onOtherKeyDown={handleOtherKeyDown}
        />

        {/* Footer */}
        <Footer
          showSubmitButton={form.showSubmitButton}
          canSubmit={form.canSubmitCurrent}
          isLastTab={form.isLastTab}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};
