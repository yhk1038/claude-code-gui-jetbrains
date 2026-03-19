import { useState } from 'react';
import { Portal } from '@/components/Portal';
import type { ImageAttachment } from '../../../../types';

interface Props {
  attachment: ImageAttachment;
  onRemove: (id: string) => void;
}

export function ImagePreview(props: Props) {
  const { attachment, onRemove } = props;
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div className="relative group">
        <div className="w-16 h-16 rounded-md overflow-hidden border border-zinc-700 bg-zinc-800/50">
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
          className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-zinc-700 hover:bg-red-500 text-zinc-300 text-[10px] transition-colors opacity-0 group-hover:opacity-100"
        >
          ×
        </button>
        <div className="text-[10px] text-zinc-500 truncate max-w-[64px] mt-0.5 text-center">
          {attachment.displayLabel}
        </div>
      </div>

      {showLightbox && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={attachment.dataUrl}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute -top-3.5 -right-3.5 w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800/20 hover:bg-zinc-700/70 border border-zinc-700 text-zinc-200 transition-colors"
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
