import React from 'react';
import { LoadedMessageDto } from '../../../types';
import { useTranslation } from '@/i18n';

interface InterruptedMessageRendererProps {
  message: LoadedMessageDto;
  label?: string;
}

export const InterruptedMessageRenderer: React.FC<InterruptedMessageRendererProps> = ({ label }) => {
  const { t } = useTranslation('chatTools');
  return (
    <div className="mt-[18px] mb-[12px] py-2 px-4">
      <div className="flex items-center gap-1.5 text-[1rem] text-text-primary/60 italic">
        {label ?? t('interrupted.default')}
      </div>
    </div>
  );
};
