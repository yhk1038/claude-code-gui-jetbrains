import { useRef, useEffect, KeyboardEvent } from 'react';
import { OptionItem } from '@/pages/ChatPage/message-renderers/ToolRenderers/AskUserQuestion/OptionItem';
import { useTextareaAutoResize } from '@/pages/ChatPage/ChatInput/hooks/useTextareaAutoResize';
import { QuestionOption } from './useFormState';
import { useTranslation } from '@/i18n';

/** Internal sentinel value for the "Other" option; must stay untranslated
 * because form state (useFormState.ts) compares against this literal. */
const OTHER_OPTION_VALUE = 'Other';

interface Props {
  options: QuestionOption[];
  selected: string[];
  multiSelect: boolean;
  isOtherSelected: boolean;
  otherText: string;
  onSelect: (label: string) => void;
  onOtherTextChange: (text: string) => void;
  onOtherKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const OptionList = (props: Props) => {
  const {
    options,
    selected,
    multiSelect,
    isOtherSelected,
    otherText,
    onSelect,
    onOtherTextChange,
    onOtherKeyDown,
  } = props;

  const { t } = useTranslation('chat');
  const otherInputRef = useRef<HTMLTextAreaElement>(null);

  useTextareaAutoResize({ textareaRef: otherInputRef, value: otherText, maxHeight: 120 });

  useEffect(() => {
    if (isOtherSelected) {
      setTimeout(() => otherInputRef.current?.focus(), 0);
    }
  }, [isOtherSelected]);

  return (
    <div className="px-3 py-2.5 flex flex-col gap-1.5">
      {options.map((option) => (
        <OptionItem
          key={option.label}
          label={option.label === OTHER_OPTION_VALUE ? t('askUserQuestion.other') : option.label}
          description={option.description}
          selected={selected.includes(option.label)}
          multiSelect={multiSelect}
          disabled={false}
          onClick={() => onSelect(option.label)}
        />
      ))}

      {isOtherSelected && (
        <div className="mt-1">
          <textarea
            ref={otherInputRef}
            value={otherText}
            onChange={e => onOtherTextChange(e.target.value)}
            onKeyDown={onOtherKeyDown}
            placeholder={t('askUserQuestion.otherPlaceholder')}
            rows={1}
            className="w-full px-3 py-1.5 rounded bg-surface-overlay border border-border-strong text-text-primary text-sm placeholder-text-tertiary focus:outline-none focus:border-border-focus/50 resize-none"
          />
        </div>
      )}
    </div>
  );
};
