import React, { useState } from 'react';
import { Portal } from '@/components/Portal';
import type { ImageBlockDto } from '../../../../dto/message/ContentBlockDto';
import { useTranslation } from '@/i18n';

interface ImageAttachmentsProps {
  images: ImageBlockDto[];
}

export const ImageAttachments: React.FC<ImageAttachmentsProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { t } = useTranslation('chatTools');

  const getImageSrc = (image: ImageBlockDto): string => {
    if (image.source.type === 'base64') {
      return `data:${image.source.media_type};base64,${image.source.data}`;
    }
    return image.source.data; // URL type
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <div
            key={`img-${index}-${image.source.media_type}`}
            className="group relative cursor-pointer"
            onClick={() => setSelectedImage(getImageSrc(image))}
          >
            <div className="overflow-hidden rounded-md border border-border-default bg-surface-hover hover:bg-surface-hover/80 transition-colors">
              <img
                src={getImageSrc(image)}
                alt={t('attachments.imageAlt', { index: index + 1 })}
                className="w-[110px] h-[60px] object-cover"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox for full-size image */}
      {selectedImage && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-scrim backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={selectedImage}
              alt={t('attachments.fullSizeAlt')}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute -top-3.5 -end-3.5 w-7 h-7 flex items-center justify-center rounded-full bg-surface-hover hover:bg-surface-tooltip/70 border border-border-default text-text-primary transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
};
