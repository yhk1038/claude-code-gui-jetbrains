import { useState } from 'react';
import { Portal } from '@/components/Portal';
import type { ImageAttachment } from '../../../../types';
import { useTranslation } from '@/i18n';

interface Props {
  attachment: ImageAttachment;
  onRemove: (id: string) => void;
}

export function ImagePreview(props: Props) {
  const { attachment, onRemove } = props;
  const [showLightbox, setShowLightbox] = useState(false);
  const { t } = useTranslation('chat');

  return (
    <>
      <div className="relative group">
        <div className="w-16 h-16 rounded-md overflow-hidden border border-border-default bg-surface-hover">
          <img
            src={attachment.dataUrl}
            alt={attachment.displayLabel}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => setShowLightbox(true)}
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="absolute -top-1.5 -end-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-surface-tooltip hover:bg-state-error-fg text-text-secondary text-[0.7692rem] transition-colors opacity-0 group-hover:opacity-100"
        >
          ×
        </button>
        <div className="text-[0.7692rem] text-text-tertiary truncate max-w-[64px] mt-0.5 text-center">
          {attachment.displayLabel}
        </div>
      </div>

      {showLightbox && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-scrim backdrop-blur-sm"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={attachment.dataUrl}
              alt={t('chatInput.attachmentPreview.fullSize')}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute -top-3.5 -end-3.5 w-7 h-7 flex items-center justify-center rounded-full bg-surface-hover hover:bg-surface-tooltip/70 border border-border-default text-text-primary transition-colors"
              onClick={() => setShowLightbox(false)}
            >
              ✕
            </button>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
